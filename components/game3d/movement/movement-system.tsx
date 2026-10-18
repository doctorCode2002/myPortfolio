"use client";

/**
 * Gliding and jump pads. Shows an "E Glide" / "E Bounce" prompt at launch platforms and
 * pads (only when no door, mayor or car prompt is nearer), starts the glide or the pad
 * jump on E / Space / a tap, flies the glider at a fixed step (keyboard or joystick), and
 * hands the player back to walking on landing. Gliding, jumping, walking and driving are
 * exclusive (rt.move.mode). A glide that would fall below the islands ends in a soft
 * respawn at its launch platform: no damage, just a whoosh.
 */

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type * as THREE from "three";

import { gameEvents } from "@/components/game/engine/events";
import {
  cancelGlide,
  canCancelGlide,
  createGlide,
  stepGlide,
  type GlideEnv,
  type GlideInput,
  type GlideState,
} from "../logic/glide";
import { arcPoint, type Point3 } from "../logic/jump-arc";
import {
  nearestMoveSpot,
  type JumpPad,
  type MoveSpot,
} from "../logic/movement-layout";
import { riderPoint, stepZip, ZIP, type ZipState } from "../logic/zipline";
import { surfaceAt } from "../logic/walk-world";
import { PLAYER_RADIUS_HEX, type GameWorld } from "../logic/world-layout";
import { setMoveMode, useRuntimeRef, type Runtime } from "../runtime";
import { GliderModel } from "./glider-model";
import { MovementProps, type PadBounce } from "./movement-props";
import { ZipHandle, ZipLines } from "./zipline-view";

export type MovementLabels = {
  glide: string;
  glideAction: string;
  bounce: string;
  jumpDown: string;
  zip: string;
  tap: string;
  rtl: boolean;
};

type Spot = MoveSpot;

/** Seconds to reach up from the ground to the zipline handle. */
const GRAB_TIME = 0.35;

const STEP = 1 / 60;
const MAX_STEPS = 5;
/** Ignore E / Space right after an overlay closed (same guard as Interactions). */
const REOPEN_GUARD_MS = 300;

function glideInput(rt: Runtime, out: GlideInput): GlideInput {
  out.steer = 0;
  out.pitch = 0;
  if (rt.frozen) return out;
  const k = rt.input.keys;
  if (k.has("KeyD") || k.has("ArrowRight")) out.steer += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) out.steer -= 1;
  if (k.has("KeyW") || k.has("ArrowUp")) out.pitch += 1;
  if (k.has("KeyS") || k.has("ArrowDown")) out.pitch -= 1;
  const joy = rt.input.joy;
  if (out.steer === 0 && out.pitch === 0 && Math.hypot(joy.x, joy.y) > 0.12) {
    out.steer = joy.x;
    out.pitch = joy.y;
  }
  return out;
}

function notify(rt: Runtime): void {
  for (const cb of rt.move.listeners) cb();
}

export function MovementSystem({
  world,
  labels,
  touch,
  reducedMotion,
}: {
  world: GameWorld;
  labels: MovementLabels;
  touch: boolean;
  reducedMotion: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const layout = world.movement;
  const radius = PLAYER_RADIUS_HEX * world.hexWidth;
  const env = useMemo<GlideEnv>(
    () => ({ walk: world.walk, layout, radius }),
    [world, layout, radius]
  );
  const glide = useRef<GlideState | null>(null);
  const jump = useRef<{ pad: JumpPad; t: number } | null>(null);
  const zip = useRef<(ZipState & { grab: number }) | null>(null);
  const acc = useRef(0);
  const input = useRef<GlideInput>({ steer: 0, pitch: 0 });
  const request = useRef<Spot | null>(null);
  const nearRef = useRef<Spot | null>(null);
  const [near, setNear] = useState<Spot | null>(null);
  const bounce = useRef<PadBounce>(null);
  const rig = useRef<THREE.Group>(null);
  const deploy = useRef(0);
  const tmp = useRef<Point3>({ x: 0, y: 0, z: 0 });

  const ask = useCallback((): void => {
    const rt = rtRef.current;
    const n = nearRef.current;
    if (!n || rt.frozen || rt.nearest || gameEvents.isUiLocked()) return;
    if (rt.move.mode !== "walk") return;
    if (performance.now() - rt.unfrozenAt < REOPEN_GUARD_MS) return;
    request.current = n;
  }, [rtRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || (e.code !== "KeyE" && e.code !== "Space")) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (/input|textarea|select/i.test(t.tagName) || t.isContentEditable)
      )
        return;
      const rt = rtRef.current;
      if (rt.move.mode === "glide") {
        e.preventDefault();
        rt.move.cancel = true;
        return;
      }
      if (!nearRef.current || rt.nearest) return;
      e.preventDefault();
      ask();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rtRef, ask]);

  useFrame(({ clock }, rawDt) => {
    const rt = rtRef.current;
    const dt = Math.min(rawDt, 0.05);
    const p = rt.player.pos;
    // Someone else took over (a teleport, fast travel, the car): drop our flight.
    if (rt.move.mode !== "glide") glide.current = null;
    if (rt.move.mode !== "jump") jump.current = null;
    if (rt.move.mode !== "zip") zip.current = null;

    const req = request.current;
    request.current = null;
    if (req && rt.move.mode === "walk" && !rt.frozen && !rt.car.driving) {
      rt.path = null;
      rt.target = null;
      if (req.kind === "launch") {
        const l = req.spot;
        glide.current = createGlide(p.x, l.y + 0.2, p.z, l.heading, l.id);
        acc.current = 0;
        deploy.current = reducedMotion ? 1 : 0;
        rt.player.heading = l.heading;
        setMoveMode(rt, "glide");
      } else if (req.kind === "zip") {
        const line = req.spot;
        zip.current = { line, t: 0, speed: ZIP.startSpeed, grab: 0 };
        rt.player.heading = Math.atan2(
          line.b.x - line.a.x,
          line.b.z - line.a.z
        );
        setMoveMode(rt, "zip");
      } else {
        jump.current = { pad: req.spot, t: 0 };
        bounce.current = { id: req.spot.id, at: clock.elapsedTime };
        const a = req.spot.arc;
        rt.player.heading = Math.atan2(a.to.x - a.from.x, a.to.z - a.from.z);
        setMoveMode(rt, "jump");
      }
    }

    const g = glide.current;
    if (g) {
      if (rt.move.cancel) {
        rt.move.cancel = false;
        if (canCancelGlide(env, g)) cancelGlide(g);
      }
      glideInput(rt, input.current);
      acc.current = Math.min(acc.current + dt, STEP * MAX_STEPS);
      let ended: "land" | "respawn" | null = null;
      while (acc.current >= STEP && !ended) {
        acc.current -= STEP;
        const ev = stepGlide(env, g, input.current, STEP);
        if (ev.kind === "land" || ev.kind === "respawn") ended = ev.kind;
      }
      if (ended === "respawn") {
        const l = layout.launches.find((x) => x.id === g.launchId);
        if (l) {
          p.x = l.x;
          p.y = l.y;
          p.z = l.z;
          rt.player.heading = l.heading + Math.PI;
        }
        glide.current = null;
        rt.move.whoosh++;
        setMoveMode(rt, "walk");
        notify(rt);
      } else {
        p.x = g.x;
        p.y = g.y;
        p.z = g.z;
        rt.player.heading = g.heading;
        rt.move.roll = g.bank;
        if (ended === "land") {
          glide.current = null;
          setMoveMode(rt, "walk");
        }
      }
      rt.player.speed = 0;
      const s = surfaceAt(world.walk, p.x, p.z);
      rt.player.islandId = s?.islandId ?? null;
      rt.player.bridgeId = s?.bridgeId ?? null;
    }

    const j = jump.current;
    if (j) {
      j.t += dt;
      arcPoint(j.pad.arc, j.t, tmp.current);
      p.x = tmp.current.x;
      p.y = tmp.current.y;
      p.z = tmp.current.z;
      rt.player.speed = 0;
      if (j.t >= j.pad.arc.duration) {
        const s = surfaceAt(world.walk, p.x, p.z, p.y);
        rt.player.islandId = s?.islandId ?? j.pad.islandId;
        rt.player.bridgeId = null;
        jump.current = null;
        setMoveMode(rt, "walk");
      }
    }

    const zr = zip.current;
    if (zr) {
      rt.player.speed = 0;
      if (zr.grab < GRAB_TIME) {
        // Reach up to the handle from where the player stood.
        zr.grab += dt;
        const k = Math.min(1, zr.grab / GRAB_TIME);
        riderPoint(zr.line, 0, tmp.current);
        p.x += (tmp.current.x - p.x) * k;
        p.z += (tmp.current.z - p.z) * k;
        p.y += (tmp.current.y - p.y) * k;
      } else {
        const done = stepZip(zr, dt);
        riderPoint(zr.line, zr.t, tmp.current);
        p.x = tmp.current.x;
        p.y = tmp.current.y;
        p.z = tmp.current.z;
        const under = surfaceAt(world.walk, p.x, p.z);
        rt.player.islandId = under?.islandId ?? null;
        rt.player.bridgeId = under?.bridgeId ?? null;
        if (done) {
          const e = zr.line.end;
          p.x = e.x;
          p.y = e.y;
          p.z = e.z;
          rt.player.islandId = zr.line.toIslandId;
          rt.player.bridgeId = null;
          zip.current = null;
          setMoveMode(rt, "walk");
        }
      }
    }

    // The glider rig follows the pilot (a quick unfold after the launch).
    const r = rig.current;
    if (r) {
      const flying = glide.current !== null;
      r.visible = flying;
      if (flying && glide.current) {
        const gs = glide.current;
        deploy.current = Math.min(1, deploy.current + dt * 3);
        const k = deploy.current;
        r.position.set(p.x, p.y, p.z);
        r.rotation.set(
          Math.max(-0.25, Math.min(0.25, gs.vy * 0.04)),
          gs.heading,
          gs.bank,
          "YXZ"
        );
        r.scale.set(0.3 + 0.7 * k, 0.3 + 0.7 * k, 1);
      }
    }

    // The prompt: only on foot, only when nothing else is in range.
    let n: Spot | null = null;
    if (rt.move.mode === "walk" && !rt.frozen && !rt.nearest)
      n = nearestMoveSpot(layout, p.x, p.y, p.z);
    if ((n?.spot.id ?? null) !== (nearRef.current?.spot.id ?? null)) {
      nearRef.current = n;
      setNear(n);
    }
  });

  const title =
    near?.kind === "launch"
      ? labels.glide
      : near?.kind === "zip"
        ? labels.zip
        : near?.spot.kind === "return"
          ? labels.jumpDown
          : labels.bounce;
  return (
    <>
      <MovementProps
        layout={layout}
        bounce={bounce}
        reducedMotion={reducedMotion}
      />
      <GliderModel ref={rig} />
      <ZipLines lines={layout.ziplines} />
      <ZipHandle lines={layout.ziplines} ride={zip} />
      {near ? (
        <Html
          position={[near.spot.x, near.spot.y + 1.5, near.spot.z]}
          center
          zIndexRange={[35, 30]}
          style={{ pointerEvents: "none" }}
        >
          <button
            type="button"
            dir={labels.rtl ? "rtl" : "ltr"}
            onClick={ask}
            onPointerDown={(e) => e.stopPropagation()}
            className="border-foreground/15 bg-background/90 text-foreground pointer-events-auto flex max-w-[16rem] cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-start text-xs font-medium whitespace-nowrap shadow-lg backdrop-blur-md transition-transform duration-150 hover:scale-105 sm:text-sm"
            data-game3d-move-prompt={near.spot.id}
          >
            <kbd className="bg-accent text-background flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold">
              {touch ? labels.tap : "E"}
            </kbd>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold">{title}</span>
              {near.kind === "launch" ? (
                <span className="text-muted-foreground truncate text-[11px]">
                  {labels.glideAction}
                </span>
              ) : null}
            </span>
          </button>
        </Html>
      ) : null}
    </>
  );
}
