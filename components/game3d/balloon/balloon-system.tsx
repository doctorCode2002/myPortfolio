"use client";

/**
 * The hot-air balloon. It waits tethered on home's launch field; "E Board balloon" opens
 * a tiny chooser (scenic tour or free flight, in the HUD). The scenic tour follows the
 * precomputed path around all the islands and back; E / Esc leaves early (the autopilot
 * lands on the nearest island, or back on the field over the void). Free flight: Space
 * burns (climb), Shift vents (sink), WASD / arrows / the joystick drift relative to the
 * camera, the wind pushes; E lands when low over open ground. The balloon parks where it
 * lands (a walk obstacle) and can be boarded there again. Only one mode at a time
 * (rt.move.mode "balloon"): no prompts, driving, gliding or fast travel meanwhile.
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

import { gameEvents } from "@/components/game/engine/events";
import { atmosphere } from "../atmosphere/store";
import { emitSoundCue } from "../audio/sound-store";
import { cameraRelative } from "../logic/camera-math";
import type { Manifest } from "../logic/types";
import { surfaceAt } from "../logic/walk-world";
import { PLAYER_RADIUS_HEX, type GameWorld } from "../logic/world-layout";
import { markAboveClouds } from "../meta/store";
import { setMoveMode, useRuntimeRef, type Runtime } from "../runtime";
import {
  buildBalloonWorld,
  syncBalloonObstacle,
  canBoard,
  canTryLanding,
  createBalloonState,
  exitTarget,
  findParking,
  startAutopilot,
  stepAutopilot,
  stepFree,
  tourLabel,
  tourPoint,
  windAt,
  type Autopilot,
  type BalloonState,
  type FreeInput,
  type Parking,
} from "./balloon-logic";
import {
  BalloonModel,
  FieldSign,
  TETHER_PEGS,
  type BalloonHandles,
} from "./balloon-model";
import {
  balloonRequests,
  flashBalloonHint,
  getBalloonUi,
  setBalloonUi,
  type BalloonPhase,
} from "./balloon-store";

export type BalloonPromptLabels = {
  board: string;
  boardAction: string;
  tap: string;
  rtl: boolean;
};

const STEP = 1 / 60;
const MAX_STEPS = 5;
const REOPEN_GUARD_MS = 300;
/** Boarding reach from the basket's centre (m) and height tolerance. */
const BOARD_RANGE = 1.9;
/** Basket floor thickness: the pilot stands on it. */
const FLOOR = 0.08;
const UI_LOCK = "balloon";

/** Dev only: ?balloonSpeed=<n> speeds up the scenic tour. */
function tourSpeed(): number {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined")
    return 1;
  const v = Number(
    new URLSearchParams(window.location.search).get("balloonSpeed")
  );
  return Number.isFinite(v) && v > 0 ? Math.min(20, v) : 1;
}

type Sim = {
  phase: BalloonPhase;
  s: BalloonState;
  park: Parking;
  tourT: number;
  hint: number;
  auto: Autopilot | null;
  /** Where the autopilot lands. */
  target: Parking;
  /** What the autopilot does on arrival: land, or start the tour (from the field). */
  then: "land" | "tour";
  /** The tour was flown to the end (the achievement). */
  touring: boolean;
  acc: number;
  cue: number;
  lastY: number;
  /** World heading of the field's tether line (both pegs on the ground). */
  tether: number;
};

/** A heading for the tethers (their local +z) that puts both pegs on the field's ground. */
function tetherHeading(walk: GameWorld["walk"], f: Parking): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    let score = 0;
    for (const [px, pz] of TETHER_PEGS) {
      // Rotate the local peg offset by the heading a (three's rotation about +y).
      const wx = f.x + px * c + pz * sn;
      const wz = f.z - px * sn + pz * c;
      const s = surfaceAt(walk, wx, wz);
      if (s && s.islandId && Math.abs(s.y - f.y) < 0.3) score += 2;
      const mx = f.x + (px * c + pz * sn) * 0.5;
      const mz = f.z + (-px * sn + pz * c) * 0.5;
      if (surfaceAt(walk, mx, mz)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

function freeInput(rt: Runtime, out: FreeInput): FreeInput {
  out.lift = 0;
  out.dx = 0;
  out.dz = 0;
  if (rt.frozen) return out;
  const k = rt.input.keys;
  if (k.has("Space") || balloonRequests.up) out.lift += 1;
  if (k.has("ShiftLeft") || k.has("ShiftRight") || balloonRequests.down)
    out.lift -= 1;
  let x = 0;
  let y = 0;
  if (k.has("KeyW") || k.has("ArrowUp")) y += 1;
  if (k.has("KeyS") || k.has("ArrowDown")) y -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) x += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) x -= 1;
  const len = Math.hypot(x, y);
  if (len > 0) {
    x /= len;
    y /= len;
  } else {
    const j = rt.input.joy;
    if (Math.hypot(j.x, j.y) > 0.12) {
      x = j.x;
      y = j.y;
    }
  }
  if (x !== 0 || y !== 0) {
    const d = cameraRelative(x, y, rt.camera.yaw);
    out.dx = d.x;
    out.dz = d.z;
  }
  return out;
}

export function BalloonSystem({
  world,
  manifest,
  labels,
  touch,
  reducedMotion,
}: {
  world: GameWorld;
  manifest: Manifest | null;
  labels: BalloonPromptLabels;
  touch: boolean;
  reducedMotion: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const radius = PLAYER_RADIUS_HEX * world.hexWidth;
  const bw = useMemo(
    () => buildBalloonWorld(world, manifest, radius),
    [world, manifest, radius]
  );
  const model = useRef<BalloonHandles>(null);
  const sim = useRef<Sim | null>(null);
  const nearRef = useRef(false);
  const [near, setNear] = useState(false);
  const [parkAt, setParkAt] = useState<Parking | null>(null);
  const input = useRef<FreeInput>({ lift: 0, dx: 0, dz: 0 });
  const wind = useRef({ x: 0, z: 0 });
  const tmp = useRef({ x: 0, y: 0, z: 0 });
  const speed = useMemo(() => tourSpeed(), []);
  const simFor = useRef<unknown>(null);

  // Leaving the world: no obstacle, no lock, a fresh HUD.
  useEffect(() => {
    const walk = world.walk;
    return () => {
      syncBalloonObstacle(walk, null);
      gameEvents.unlockUi(UI_LOCK);
      setBalloonUi({ chooser: false, phase: "parked", label: null });
      delete (window as unknown as { __balloon?: unknown }).__balloon;
    };
  }, [world]);

  const openChooser = useCallback((): void => {
    const rt = rtRef.current;
    if (!nearRef.current || rt.nearest || gameEvents.isUiLocked()) return;
    if (!canBoard(rt.move.mode, rt.car.driving, rt.frozen)) return;
    if (performance.now() - rt.unfrozenAt < REOPEN_GUARD_MS) return;
    rt.path = null;
    rt.target = null;
    setBalloonUi({ chooser: true });
    gameEvents.lockUi(UI_LOCK);
  }, [rtRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (/input|textarea|select/i.test(t.tagName) || t.isContentEditable)
      )
        return;
      const rt = rtRef.current;
      if (rt.move.mode === "balloon") {
        // Not the Esc / E that just closed an overlay (photo mode, the passport).
        if (rt.frozen || performance.now() - rt.unfrozenAt < REOPEN_GUARD_MS)
          return;
        const phase = sim.current?.phase;
        if (e.code === "KeyE" || (e.code === "Escape" && phase === "tour")) {
          e.preventDefault();
          balloonRequests.action = true;
        }
        return;
      }
      if (e.code !== "KeyE" || !nearRef.current || rt.nearest) return;
      e.preventDefault();
      openChooser();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rtRef, openChooser]);

  /** Step out onto the parking spot's exit and walk on. */
  const land = useCallback(
    (rt: Runtime, m: Sim, spot: Parking, walk: GameWorld["walk"]): void => {
      m.phase = "parked";
      m.auto = null;
      m.park = spot;
      m.s.x = spot.x;
      m.s.y = spot.y;
      m.s.z = spot.z;
      m.s.vx = 0;
      m.s.vz = 0;
      m.s.vy = 0;
      const p = rt.player.pos;
      p.x = spot.exit.x;
      p.y = spot.exit.y;
      p.z = spot.exit.z;
      rt.player.heading = Math.atan2(spot.x - p.x, spot.z - p.z) + Math.PI;
      rt.player.islandId = spot.islandId;
      rt.player.bridgeId = null;
      rt.spawnIsland = spot.islandId;
      setParkAt(spot);
      syncBalloonObstacle(walk, spot);
      setMoveMode(rt, "walk");
      setBalloonUi({ phase: "parked", label: null });
      if (m.touring) {
        m.touring = false;
        markAboveClouds();
      }
    },
    []
  );

  useFrame(({ clock }, rawDt) => {
    const rt = rtRef.current;
    if (!bw) return;
    // A new world: the balloon waits on the field.
    if (simFor.current !== bw || !sim.current) {
      simFor.current = bw;
      const f = bw.field;
      sim.current = {
        phase: "parked",
        s: createBalloonState(f.x, f.y, f.z, bw.fieldHeading),
        park: f,
        tourT: 0,
        hint: 0,
        auto: null,
        target: f,
        then: "land",
        touring: false,
        acc: 0,
        cue: 0,
        lastY: f.y,
        tether: tetherHeading(world.walk, f),
      };
      setParkAt(f);
      syncBalloonObstacle(world.walk, f);
      setBalloonUi({ phase: "parked", label: null, chooser: false });
      if (process.env.NODE_ENV !== "production")
        (window as unknown as { __balloon?: unknown }).__balloon = {
          bw,
          sim: sim.current,
        };
    }
    const m = sim.current;
    const h = model.current;
    const dt = Math.min(rawDt, 0.05);
    const s = m.s;

    // Someone else took over (a dev teleport): the balloon goes home to the field.
    if (m.phase !== "parked" && rt.move.mode !== "balloon") {
      m.phase = "parked";
      m.auto = null;
      m.touring = false;
      m.park = bw.field;
      s.x = bw.field.x;
      s.y = bw.field.y;
      s.z = bw.field.z;
      setParkAt(bw.field);
      syncBalloonObstacle(world.walk, bw.field);
      setBalloonUi({ phase: "parked", label: null });
    }

    // Boarding (the chooser's answer).
    const start = balloonRequests.start;
    balloonRequests.start = null;
    if (
      start &&
      m.phase === "parked" &&
      canBoard(rt.move.mode, rt.car.driving, rt.frozen)
    ) {
      rt.path = null;
      rt.target = null;
      syncBalloonObstacle(world.walk, null);
      setMoveMode(rt, "balloon");
      balloonRequests.action = false;
      m.acc = 0;
      if (start === "free") m.phase = "free";
      else if (m.park === bw.field) {
        m.phase = "tour";
        m.tourT = 0;
        m.hint = 0;
        m.touring = true;
      } else {
        m.phase = "auto";
        m.target = bw.field;
        m.auto = startAutopilot(bw.env, s, bw.field);
        m.then = "tour";
      }
      setBalloonUi({ phase: m.phase });
    }

    // E / Esc / the HUD buttons while flying.
    if (balloonRequests.action) {
      balloonRequests.action = false;
      if (m.phase === "tour") {
        m.touring = false;
        m.phase = "auto";
        m.then = "land";
        m.target = exitTarget(bw.env, s.x, s.z, bw.field);
        m.auto = startAutopilot(bw.env, s, m.target);
        setBalloonUi({ phase: "auto", label: null });
      } else if (m.phase === "free") {
        if (!canTryLanding(bw.env, s)) flashBalloonHint("lower");
        else {
          const spot = findParking(bw.env, s.x, s.z);
          if (!spot) flashBalloonHint("noRoom");
          else {
            m.phase = "auto";
            m.then = "land";
            m.target = spot;
            m.auto = startAutopilot(bw.env, s, spot);
            setBalloonUi({ phase: "auto" });
          }
        }
      }
    }

    const flying = m.phase !== "parked";
    if (flying && !rt.frozen) {
      if (m.phase === "tour") {
        m.tourT += dt * speed;
        m.hint = tourPoint(bw.tour, m.tourT, tmp.current, m.hint);
        const t = tmp.current;
        const vy = (t.y - s.y) / Math.max(dt, 1e-4);
        const dx = t.x - s.x;
        const dz = t.z - s.z;
        if (Math.hypot(dx, dz) > 1e-3) {
          const want = Math.atan2(dx, dz);
          let d = (want - s.heading) % (Math.PI * 2);
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          s.heading += d * Math.min(1, dt * 0.6);
        }
        s.vx = dx / Math.max(dt, 1e-4);
        s.vz = dz / Math.max(dt, 1e-4);
        s.x = t.x;
        s.y = t.y;
        s.z = t.z;
        const flare = vy > 0.35 ? 1 : vy > 0.05 ? 0.55 : 0.12;
        s.burn += (flare - s.burn) * Math.min(1, dt * 5);
        const label = tourLabel(bw.tour, m.tourT);
        if (label !== getBalloonUi().label)
          setBalloonUi(label ? { label, lastLabel: label } : { label });
        if (m.tourT >= bw.tour.duration) land(rt, m, bw.field, world.walk);
      } else if (m.phase === "free") {
        freeInput(rt, input.current);
        windAt(atmosphere.gust, atmosphere.rain, wind.current);
        m.acc = Math.min(m.acc + dt, STEP * MAX_STEPS);
        let ceiling = false;
        while (m.acc >= STEP) {
          m.acc -= STEP;
          ceiling =
            stepFree(bw.env, s, input.current, wind.current, STEP).ceiling ||
            ceiling;
        }
        if (ceiling) markAboveClouds();
      } else if (m.phase === "auto" && m.auto) {
        m.acc = Math.min(m.acc + dt, STEP * MAX_STEPS);
        let done = false;
        while (m.acc >= STEP && !done) {
          m.acc -= STEP;
          done = stepAutopilot(s, m.auto, STEP);
        }
        if (done) {
          if (m.then === "tour") {
            m.auto = null;
            m.phase = "tour";
            m.tourT = 0;
            m.hint = 0;
            m.touring = true;
            setBalloonUi({ phase: "tour" });
          } else land(rt, m, m.target, world.walk);
        }
      }
    } else if (!flying) {
      s.burn += (0.08 - s.burn) * Math.min(1, dt * 3);
    }

    // Sway and bob (never with reduced motion).
    const t = clock.elapsedTime;
    const still = reducedMotion || rt.reducedMotion;
    const air = flying ? Math.min(1, Math.max(0, (s.y - m.park.y) / 2)) : 0;
    const bob = still ? 0 : Math.sin(t * 0.6) * 0.12 * air;
    const gust = atmosphere.gust + atmosphere.rain * 0.5;
    if (flying && rt.move.mode === "balloon") {
      const p = rt.player.pos;
      p.x = s.x;
      p.y = s.y + FLOOR + bob;
      p.z = s.z;
      rt.player.heading = s.heading;
      rt.player.speed = 0;
      const under = surfaceAt(world.walk, s.x, s.z);
      const low = under && s.y - under.y < 6;
      rt.player.islandId = low ? under.islandId : null;
      rt.player.bridgeId = low ? under.bridgeId : null;
    }

    if (h) {
      h.root.position.set(s.x, s.y + bob, s.z);
      h.root.rotation.y = s.heading;
      if (still) h.sway.rotation.set(0, 0, 0);
      else {
        const k = 0.02 + gust * 0.03 * air;
        h.sway.rotation.set(
          Math.sin(t * 0.45 + 1) * k * air - s.vz * 0.004,
          0,
          Math.sin(t * 0.37) * k * air + s.vx * 0.004
        );
      }
      h.tethers.visible = !flying && m.park === bw.field;
      h.tethers.rotation.y = m.tether - s.heading;
      const flick = still
        ? 1
        : 0.85 + Math.sin(t * 31) * 0.08 + Math.sin(t * 17.3 + 2) * 0.07;
      const len = (0.22 + s.burn * 0.95) * flick;
      const w = 0.8 + s.burn * 0.5;
      h.flameOuter.scale.set(w, len, w);
      h.flameInner.scale.set(w * 0.55, len * 0.6, w * 0.55);
      const night = atmosphere.night;
      const glow = Math.min(1, s.burn * (0.55 + night * 0.6) + night * 0.12);
      const gm = h.glow.material;
      gm.opacity = glow;
      const gs = 0.9 + s.burn * 1.6 + night * 1.2;
      h.glow.scale.set(gs, gs, 1);
      // The envelope lit from inside at night (soft: the gores keep their colours).
      h.envelopeMat.emissiveIntensity = night * (0.08 + s.burn * 0.5 * flick);
    }

    // The burner's roar while it fires (only heard when sound is on).
    if (flying && s.burn > 0.55) {
      m.cue -= dt;
      if (m.cue <= 0) {
        m.cue = 0.42;
        emitSoundCue({ kind: "burner", strength: s.burn });
      }
    } else m.cue = 0;

    // The boarding prompt: on foot, near the parked basket, nothing else in range.
    let n = false;
    if (
      m.phase === "parked" &&
      canBoard(rt.move.mode, rt.car.driving, rt.frozen) &&
      !rt.nearest
    ) {
      const p = rt.player.pos;
      n =
        Math.hypot(p.x - s.x, p.z - s.z) <= BOARD_RANGE &&
        Math.abs(p.y - s.y) < 1.3;
    }
    if (n !== nearRef.current) {
      nearRef.current = n;
      setNear(n);
    }
  });

  if (!bw) return null;
  const f = bw.field;
  // The sign stands a little in front of the basket, towards home's middle.
  const home = bw.env.islands.find((i) => i.id === f.islandId);
  const dirX = (home?.x ?? 0) - f.x;
  const dirZ = (home?.z ?? 0) - f.z;
  const dl = Math.hypot(dirX, dirZ) || 1;
  const signX = f.x + (dirX / dl) * 2.1 + (dirZ / dl) * 1.3;
  const signZ = f.z + (dirZ / dl) * 2.1 - (dirX / dl) * 1.3;
  const signHeading = Math.atan2(dirX, dirZ);
  return (
    <>
      <BalloonModel ref={model} />
      <FieldSign
        x={signX}
        y={surfaceAt(world.walk, signX, signZ)?.y ?? f.y}
        z={signZ}
        heading={signHeading}
      />
      {near && parkAt ? (
        <Html
          position={[parkAt.x, parkAt.y + 1.7, parkAt.z]}
          center
          zIndexRange={[35, 30]}
          style={{ pointerEvents: "none" }}
        >
          <button
            type="button"
            dir={labels.rtl ? "rtl" : "ltr"}
            onClick={openChooser}
            onPointerDown={(e) => e.stopPropagation()}
            className="border-foreground/15 bg-background/90 text-foreground pointer-events-auto flex max-w-[16rem] cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-start text-xs font-medium whitespace-nowrap shadow-lg backdrop-blur-md transition-transform duration-150 hover:scale-105 sm:text-sm"
            data-game3d-balloon-prompt
          >
            <kbd className="bg-accent text-background flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold">
              {touch ? labels.tap : "E"}
            </kbd>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold">{labels.board}</span>
              <span className="text-muted-foreground truncate text-[11px]">
                {labels.boardAction}
              </span>
            </span>
          </button>
        </Html>
      ) : null}
    </>
  );
}
