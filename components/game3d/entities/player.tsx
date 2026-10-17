"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { CHARACTER_COLORS, playerModelFor } from "../assets/characters";
import { angleDelta, cameraRelative, damp } from "../logic/camera-math";
import { canStand, moveCircle, nearestStandable } from "../logic/collision";
import type { Manifest } from "../logic/types";
import { worldToIslandHex } from "../logic/walk-grid";
import { surfaceAt, type Surface } from "../logic/walk-world";
import {
  PLAYER_RADIUS_HEX,
  spawnPoint,
  type GameWorld,
} from "../logic/world-layout";
import { islandBob, useRuntimeRef, type Runtime } from "../runtime";
import { CharacterModel, type AnimState } from "./character-model";

export const WALK_SPEED = 2.1;
export const RUN_SPEED = 4.4;

/** Put the player on an island's spawn (falls back to home for unknown ids). */
function placeOnIsland(
  rt: Runtime,
  world: GameWorld,
  islandId: string,
  radius: number
): void {
  const id = world.islands.some((i) => i.id === islandId) ? islandId : "home";
  const sp = spawnPoint(world, id);
  const ok = nearestStandable(world.walk, sp.x, sp.z, radius);
  rt.player.pos = ok ? { x: ok.x, y: ok.surface.y, z: ok.z } : sp;
  rt.player.heading = Math.PI;
  rt.path = null;
  rt.target = null;
  rt.placed = true;
}

/** Visual bob under a surface: the island's, or a blend of both ends on a bridge. */
export function surfaceBob(
  world: GameWorld,
  s: Surface | null,
  t: number,
  rm: boolean
): number {
  if (!s) return 0;
  if (s.islandId) return islandBob(s.islandId, t, rm);
  const br = world.walk.bridges.find((b) => b.id === s.bridgeId);
  if (!br) return 0;
  return islandBob(br.from, t, rm) * (1 - s.t) + islandBob(br.to, t, rm) * s.t;
}

function readKeys(rt: Runtime): { x: number; y: number; run: boolean } {
  const k = rt.input.keys;
  let x = 0;
  let y = 0;
  if (k.has("KeyW") || k.has("ArrowUp")) y += 1;
  if (k.has("KeyS") || k.has("ArrowDown")) y -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) x += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) x -= 1;
  const len = Math.hypot(x, y);
  const joy = rt.input.joy;
  const jm = Math.hypot(joy.x, joy.y);
  if (len > 0)
    return {
      x: x / len,
      y: y / len,
      run: k.has("ShiftLeft") || k.has("ShiftRight"),
    };
  if (jm > 0.12) return { x: joy.x, y: joy.y, run: jm > 0.85 };
  return { x: 0, y: 0, run: false };
}

/**
 * The player: camera-relative keyboard / joystick movement or click-to-move path
 * following, circle-collider sliding on the walk world, terrain-height following and
 * Idle / Walk / Run animation states.
 */
export function Player({
  world,
  manifest,
  charId,
}: {
  world: GameWorld;
  manifest: Manifest | null;
  charId: string;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const group = useRef<THREE.Group>(null);
  const anim = useRef<AnimState>({ anim: "idle", speed: 0 });
  const vel = useRef({ x: 0, z: 0 });
  const stuck = useRef(0);
  const radius = PLAYER_RADIUS_HEX * world.hexWidth;
  const modelName = useMemo(
    () => playerModelFor(manifest, charId),
    [manifest, charId]
  );

  // Place the player on the home spawn once per world.
  // Place the player when a world is built. A rebuild (HMR, manifest or bounds arriving)
  // keeps the current position if it is still standable; otherwise respawn on the
  // remembered island (dev ?island=<id> or the last teleport).
  useLayoutEffect(() => {
    const rt = rtRef.current;
    const p = rt.player.pos;
    if (rt.placed && canStand(world.walk, p.x, p.z, radius)) return;
    placeOnIsland(rt, world, rt.spawnIsland, radius);
  }, [world, radius, rtRef]);

  useFrame(({ clock }, rawDt) => {
    const rt = rtRef.current;
    if (rt.teleport) {
      rt.spawnIsland = rt.teleport;
      rt.teleport = null;
      placeOnIsland(rt, world, rt.spawnIsland, radius);
    }
    const dt = Math.min(rawDt, 0.05);
    const p = rt.player.pos;
    let dirX = 0;
    let dirZ = 0;
    let run = false;
    if (!rt.frozen) {
      const input = readKeys(rt);
      if (input.x !== 0 || input.y !== 0) {
        rt.path = null;
        rt.target = null;
        const d = cameraRelative(input.x, input.y, rt.camera.yaw);
        dirX = d.x;
        dirZ = d.z;
        run = input.run;
      } else if (rt.path && rt.path.length > 0) {
        const wp = rt.path[0] as { x: number; z: number };
        const dx = wp.x - p.x;
        const dz = wp.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.12) {
          rt.path.shift();
          if (rt.path.length === 0) {
            rt.path = null;
            rt.target = null;
          }
        } else {
          const remaining = rt.path.reduce(
            (acc, cur, i, arr) =>
              acc +
              (i === 0
                ? d
                : Math.hypot(
                    cur.x - (arr[i - 1]?.x ?? 0),
                    cur.z - (arr[i - 1]?.z ?? 0)
                  )),
            0
          );
          // Ease into the last waypoint.
          const scale = rt.path.length === 1 ? Math.min(1, d / 0.6) : 1;
          dirX = (dx / d) * Math.max(scale, 0.35);
          dirZ = (dz / d) * Math.max(scale, 0.35);
          run = remaining > 7;
        }
      }
    }
    const target = run ? RUN_SPEED : WALK_SPEED;
    const k = damp(12, dt);
    vel.current.x += (dirX * target - vel.current.x) * k;
    vel.current.z += (dirZ * target - vel.current.z) * k;
    if (
      dirX === 0 &&
      dirZ === 0 &&
      Math.hypot(vel.current.x, vel.current.z) < 0.05
    ) {
      vel.current.x = 0;
      vel.current.z = 0;
    }
    const res = moveCircle(
      world.walk,
      p,
      vel.current.x * dt,
      vel.current.z * dt,
      radius
    );
    const moved = Math.hypot(res.x - p.x, res.z - p.z);
    const speed = moved / Math.max(dt, 1e-4);
    if (rt.path && moved < 0.002) {
      stuck.current += dt;
      if (stuck.current > 0.6) {
        rt.path = null;
        rt.target = null;
      }
    } else stuck.current = 0;
    p.x = res.x;
    p.z = res.z;
    // Smooth the height a little so one-level steps don't snap.
    p.y += (res.y - p.y) * damp(18, dt);

    const surface = res.surface ?? surfaceAt(world.walk, p.x, p.z, p.y);
    rt.player.speed = speed;
    rt.player.islandId = surface?.islandId ?? null;
    rt.player.bridgeId = surface?.bridgeId ?? null;
    const grid = world.walk.islands.find(
      (g) => g.islandId === surface?.islandId
    );
    rt.player.hex = grid ? worldToIslandHex(grid, p.x, p.z) : null;

    if (Math.hypot(dirX, dirZ) > 0.01 && speed > 0.05) {
      const want = Math.atan2(vel.current.x, vel.current.z);
      rt.player.heading += angleDelta(rt.player.heading, want) * damp(14, dt);
    }
    anim.current.speed = speed;
    anim.current.anim =
      speed > (WALK_SPEED + RUN_SPEED) / 2
        ? "run"
        : speed > 0.25
          ? "walk"
          : "idle";

    const g = group.current;
    if (g) {
      g.position.set(
        p.x,
        p.y + surfaceBob(world, surface, clock.elapsedTime, rt.reducedMotion),
        p.z
      );
      g.rotation.y = rt.player.heading;
    }
  });

  return (
    <group ref={group} name="player">
      <CharacterModel
        manifest={manifest}
        name={modelName}
        color={CHARACTER_COLORS[charId] ?? "#5b8bd9"}
        state={anim}
      />
    </group>
  );
}
