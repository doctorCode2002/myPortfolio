/**
 * A mayor's behaviour as a small state machine: patrol a short route (walk, pause, idle),
 * greet the player once when they come close, stop and face them while they talk, and
 * give a guided tour (walk ahead to each stop, wait for the player, say a line, move on).
 * Pure and allocation-light: path planning and ground height come from the caller.
 */

import type { Vec3 } from "../logic/walk-world";
import { nearestIndex, nextRouteIndex } from "./routes";

export const BRAIN = {
  /** Walking speed on the route and on a tour (m/s). */
  walkSpeed: 1.05,
  tourSpeed: 1.3,
  /** Pause at each route waypoint (seconds). */
  pauseMin: 2.4,
  pauseMax: 4.6,
  /** Greet (turn and wave) when the player comes this close, again only after they leave. */
  greetRadius: 4,
  greetReset: 7,
  cheerTime: 1.9,
  /** Face the player while paused when they are this close. */
  faceRadius: 3,
  /** Never step closer than this to the player (the colliders would overlap). */
  blockDist: 0.85,
  /** On the route, give up a blocked leg after this long and pick the next waypoint. */
  stuckSkip: 3,
  /** Tour: carry on once the player is this close; wait for them beyond `followLag`. */
  followNear: 3.4,
  followLag: 6,
  /** Tour: cancel when the player stays this far away for `abandonTime` seconds. */
  abandonDist: 14,
  abandonTime: 2,
  /** Tour: how long each stop's line stays up, and the closing line. */
  lineTime: 6,
  doneTime: 4,
} as const;

export type BrainAnim = "idle" | "walk" | "cheer";
export type BubbleKind = "follow" | "stop" | "done";

export type MayorBrain = {
  mode: "route" | "tour" | "return";
  pos: Vec3;
  /** Desired facing (radians around +y, 0 faces +z). */
  heading: number;
  path: Vec3[] | null;
  /** Index of the next path point. */
  seg: number;
  routeIndex: number;
  routeDir: { value: 1 | -1 };
  pause: number;
  cheer: number;
  greeted: boolean;
  /** Tour stop index and stage. */
  stop: number;
  stage: "walk" | "gather" | "speak" | "done";
  timer: number;
  away: number;
  blocked: number;
  anim: BrainAnim;
  speed: number;
  /** What the speech bubble shows (null: nothing). */
  bubble: BubbleKind | null;
  seed: number;
};

export type BrainEnv = {
  /** Route waypoints (world points). */
  route: readonly Vec3[];
  routeMode: "loop" | "pingpong";
  /** Tour stops (where the mayor stands). */
  stops: readonly Vec3[];
  restHeading: number;
  plan(from: Vec3, to: Vec3): Vec3[] | null;
  /** Ground height near a point, or null off the walkable area. */
  groundY(x: number, z: number, nearY: number): number | null;
};

export type BrainInput = {
  dt: number;
  player: Vec3;
  /** The player is walking (not driving or frozen) and could be greeted or guided. */
  playerActive: boolean;
  /** The dialogue with this mayor is open: stand still and face the player. */
  talking: boolean;
};

export function createBrain(
  start: Vec3,
  restHeading: number,
  seed = 0
): MayorBrain {
  return {
    mode: "route",
    pos: { x: start.x, y: start.y, z: start.z },
    heading: restHeading,
    path: null,
    seg: 0,
    routeIndex: -1,
    routeDir: { value: 1 },
    pause: 0.6 + (seed % 5) * 0.4,
    cheer: 0,
    greeted: false,
    stop: 0,
    stage: "walk",
    timer: 0,
    away: 0,
    blocked: 0,
    anim: "idle",
    speed: 0,
    bubble: null,
    seed,
  };
}

export function isTouring(b: MayorBrain): boolean {
  return b.mode === "tour";
}

function pauseFor(b: MayorBrain): number {
  const k = ((b.routeIndex + 1) * 7919 + b.seed * 104729) % 97;
  return BRAIN.pauseMin + (k / 96) * (BRAIN.pauseMax - BRAIN.pauseMin);
}

function setPath(b: MayorBrain, path: Vec3[] | null): void {
  b.path = path && path.length > 0 ? path : null;
  b.seg = 0;
  b.blocked = 0;
}

function faceTowards(b: MayorBrain, x: number, z: number): void {
  if (Math.hypot(x - b.pos.x, z - b.pos.z) > 1e-3)
    b.heading = Math.atan2(x - b.pos.x, z - b.pos.z);
}

/**
 * Walk along the current path at `speed`, never stepping into the player. Returns true
 * once the last point is reached.
 */
function walk(
  b: MayorBrain,
  env: BrainEnv,
  input: BrainInput,
  speed: number
): boolean {
  const path = b.path;
  if (!path) return true;
  let step = speed * input.dt;
  let moved = false;
  const px = input.player.x;
  const pz = input.player.z;
  while (step > 1e-6 && b.seg < path.length) {
    const t = path[b.seg] as Vec3;
    const dx = t.x - b.pos.x;
    const dz = t.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) b.heading = Math.atan2(dx, dz);
    const k = d <= step ? 1 : step / d;
    const nx = b.pos.x + dx * k;
    const nz = b.pos.z + dz * k;
    const before = Math.hypot(b.pos.x - px, b.pos.z - pz);
    const after = Math.hypot(nx - px, nz - pz);
    if (after < BRAIN.blockDist && after < before) {
      b.blocked += input.dt;
      break;
    }
    b.pos.x = nx;
    b.pos.z = nz;
    moved = true;
    if (d <= step) {
      b.seg++;
      step -= d;
    } else step = 0;
  }
  if (moved) {
    b.blocked = 0;
    const y = env.groundY(b.pos.x, b.pos.z, b.pos.y);
    if (y !== null) b.pos.y = y;
  }
  b.anim = moved ? "walk" : "idle";
  b.speed = moved ? speed : 0;
  if (b.seg >= path.length) {
    b.path = null;
    return true;
  }
  return false;
}

/** Start the guided tour (from the dialogue's "Yes"). */
export function startTour(b: MayorBrain, env: BrainEnv): void {
  const first = env.stops[0];
  if (!first) return;
  b.mode = "tour";
  b.stop = 0;
  b.stage = "walk";
  b.away = 0;
  b.cheer = 0;
  b.bubble = "follow";
  setPath(b, env.plan(b.pos, first));
}

/** End the tour (Esc, walking away, or the last stop): walk back to the route. */
export function cancelTour(b: MayorBrain, env: BrainEnv): void {
  if (b.mode !== "tour") return;
  b.mode = "return";
  b.bubble = null;
  const i = nearestIndex(env.route, b.pos.x, b.pos.z);
  b.routeIndex = i;
  const target = env.route[i];
  setPath(b, target ? env.plan(b.pos, target) : null);
}

function stepRoute(
  b: MayorBrain,
  env: BrainEnv,
  input: BrainInput,
  dp: number
): void {
  if (input.playerActive && !b.greeted && dp < BRAIN.greetRadius) {
    b.greeted = true;
    b.cheer = BRAIN.cheerTime;
    b.anim = "cheer";
    b.speed = 0;
    faceTowards(b, input.player.x, input.player.z);
    return;
  }
  if (b.path) {
    if (walk(b, env, input, BRAIN.walkSpeed)) b.pause = pauseFor(b);
    else if (b.blocked > BRAIN.stuckSkip) {
      setPath(b, null);
      b.pause = 0.4;
    }
    return;
  }
  b.anim = "idle";
  b.speed = 0;
  if (dp < BRAIN.faceRadius) faceTowards(b, input.player.x, input.player.z);
  b.pause -= input.dt;
  if (b.pause > 0 || env.route.length === 0) return;
  b.routeIndex =
    b.routeIndex < 0
      ? 0
      : nextRouteIndex(
          b.routeIndex,
          b.routeDir,
          env.route.length,
          env.routeMode
        );
  const target = env.route[b.routeIndex] as Vec3;
  setPath(b, env.plan(b.pos, target));
  if (!b.path) b.pause = BRAIN.pauseMax;
}

function stepTour(
  b: MayorBrain,
  env: BrainEnv,
  input: BrainInput,
  dp: number
): void {
  if (dp > BRAIN.abandonDist || !input.playerActive) {
    b.away += input.dt;
    if (b.away > BRAIN.abandonTime) {
      cancelTour(b, env);
      return;
    }
  } else b.away = 0;

  const idleFacing = (): void => {
    b.anim = "idle";
    b.speed = 0;
    faceTowards(b, input.player.x, input.player.z);
  };

  switch (b.stage) {
    case "walk":
      b.bubble = "follow";
      if (dp > BRAIN.followLag) {
        idleFacing();
        return;
      }
      if (!b.path || walk(b, env, input, BRAIN.tourSpeed)) {
        b.path = null;
        b.stage = "gather";
      }
      return;
    case "gather":
      idleFacing();
      if (dp < BRAIN.followNear) {
        b.stage = "speak";
        b.timer = BRAIN.lineTime;
        b.bubble = "stop";
      }
      return;
    case "speak":
      idleFacing();
      b.timer -= input.dt;
      if (b.timer > 0) return;
      b.stop++;
      if (b.stop >= env.stops.length) {
        b.stage = "done";
        b.timer = BRAIN.doneTime;
        b.bubble = "done";
        return;
      }
      b.stage = "walk";
      b.bubble = "follow";
      setPath(b, env.plan(b.pos, env.stops[b.stop] as Vec3));
      return;
    case "done":
      idleFacing();
      b.timer -= input.dt;
      if (b.timer <= 0) cancelTour(b, env);
      return;
  }
}

/** Advance the mayor by one frame. */
export function stepBrain(
  b: MayorBrain,
  env: BrainEnv,
  input: BrainInput
): void {
  const dp = Math.hypot(input.player.x - b.pos.x, input.player.z - b.pos.z);
  if (b.mode === "route" && dp > BRAIN.greetReset) b.greeted = false;
  if (input.talking) {
    b.anim = "idle";
    b.speed = 0;
    faceTowards(b, input.player.x, input.player.z);
    return;
  }
  if (b.cheer > 0) {
    b.cheer -= input.dt;
    b.anim = "cheer";
    b.speed = 0;
    faceTowards(b, input.player.x, input.player.z);
    return;
  }
  if (b.mode === "tour") {
    stepTour(b, env, input, dp);
    return;
  }
  if (b.mode === "return") {
    if (!b.path || walk(b, env, input, BRAIN.walkSpeed)) {
      b.mode = "route";
      b.path = null;
      b.pause = 1;
    } else if (b.blocked > BRAIN.stuckSkip) {
      b.mode = "route";
      setPath(b, null);
      b.pause = 0.4;
    }
    return;
  }
  stepRoute(b, env, input, dp);
}
