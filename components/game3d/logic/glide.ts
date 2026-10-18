/**
 * The paraglider: a gentle forward glide with banked turns (A/D), a dive (W) and a flare
 * (S), a slow sink, and lift from thermals (over the waterfalls and the island centres) so
 * a good flight can reach the other islands. It never hurts: touching walkable ground lands
 * on the nearest standable spot, a cliff face bounces the glider back, and dropping below
 * the islands (or flying off the map) asks for a soft respawn at the launch. Pure: no
 * three or react imports.
 *
 * Heading 0 faces +z and the forward vector is (sin heading, cos heading), like the player;
 * steering right (+1) turns clockwise seen from above, like the car.
 */

import { canStand } from "./collision";
import {
  solidTopAt,
  type MovementLayout,
  type Thermal,
} from "./movement-layout";
import { surfaceAt, type WalkWorld } from "./walk-world";

export const GLIDE = {
  /** Cruise, dive and flare airspeeds (m/s). */
  speed: 7,
  diveSpeed: 10.5,
  flareSpeed: 4.2,
  /** Sink rates at cruise, dive and flare (m/s). */
  sink: 1.15,
  diveSink: 2.9,
  flareSink: 0.75,
  /** Airspeed response (m/s²). */
  accel: 2.4,
  /** Bank angle at full steer (radians), its response (1/s), the turn rate at full bank and cruise speed. */
  bankMax: 0.55,
  bankRate: 3,
  turnRate: 1.5,
  /** Vertical speed response (1/s) and the fastest climb (m/s). */
  vyRate: 2.2,
  maxClimb: 3.4,
  /** Upward speed at the launch (a little hop off the platform). */
  launchVy: 2.5,
  /** The launch gust: extra lift fading out over the first seconds. */
  launchLift: 4.6,
  launchTime: 1.4,
  /** Lands once the feet are this close above walkable ground. */
  landGap: 0.35,
  /** A cliff whose top is at most this far above the feet is climbed onto (lands). */
  mantle: 1.1,
  /** Gravity of the drop after cancelling over ground. */
  dropG: 16,
  /** How far to look for a standable landing spot (metres). */
  landRange: 3,
} as const;

export type GlidePhase = "glide" | "drop";

export type GlideState = {
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Airspeed (m/s), forward. */
  speed: number;
  /** Vertical speed (m/s, + up). */
  vy: number;
  /** Bank (radians, + right wing down). */
  bank: number;
  phase: GlidePhase;
  /** Seconds since the launch. */
  age: number;
  /** Launch to respawn at. */
  launchId: string;
};

export type GlideInput = {
  /** -1 (left) .. 1 (right). */
  steer: number;
  /** -1 (flare, slow) .. 1 (dive, fast). */
  pitch: number;
};

export type GlideEnv = {
  walk: WalkWorld;
  layout: MovementLayout;
  /** The walker's collider radius (for the landing spot). */
  radius: number;
};

export type GlideEvent =
  | { kind: "fly" }
  | { kind: "land"; x: number; y: number; z: number }
  | { kind: "bump" }
  | { kind: "respawn" };

export function createGlide(
  x: number,
  y: number,
  z: number,
  heading: number,
  launchId: string
): GlideState {
  return {
    x,
    y,
    z,
    heading,
    speed: GLIDE.flareSpeed,
    vy: GLIDE.launchVy,
    bank: 0,
    phase: "glide",
    age: 0,
    launchId,
  };
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Rising air at a point (m/s): each thermal's core lift, easing to its rim and ceiling. */
export function thermalLift(
  thermals: readonly Thermal[],
  x: number,
  y: number,
  z: number
): number {
  let lift = 0;
  for (const t of thermals) {
    const dx = x - t.x;
    const dz = z - t.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= t.radius * t.radius) continue;
    // A broad core that falls off near the rim.
    const q = d2 / (t.radius * t.radius);
    const across = 1 - q * q;
    const below = Math.min(1, Math.max(0, (t.ceiling - y) / 3));
    lift += t.strength * across * below;
  }
  return lift;
}

/**
 * A standable spot for the walker near (x, z) at about `groundY`: the point itself, then
 * rings around it out to `range` metres. Null if nothing fits (crowded props, a roof edge).
 */
export function findLanding(
  walk: WalkWorld,
  x: number,
  z: number,
  groundY: number,
  radius: number,
  range: number = GLIDE.landRange
): { x: number; y: number; z: number } | null {
  const here = canStand(walk, x, z, radius, groundY);
  if (here) return { x, y: here.y, z };
  for (let ring = 0.25; ring <= range + 1e-6; ring += 0.25) {
    const n = Math.max(8, Math.round(ring * 10));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * ring;
      const pz = z + Math.sin(a) * ring;
      const s = canStand(walk, px, pz, radius, groundY);
      if (s) return { x: px, y: s.y, z: pz };
    }
  }
  return null;
}

/** Walkable ground straight below the glider (within `maxDrop` metres), or null. */
export function groundBelow(
  walk: WalkWorld,
  x: number,
  y: number,
  z: number,
  maxDrop = 14
): number | null {
  const s = surfaceAt(walk, x, z, y);
  if (!s || s.y > y + 0.1 || y - s.y > maxDrop) return null;
  return s.y;
}

/** Whether a cancel (Space / E / the Land button) is allowed: only over ground. */
export function canCancelGlide(env: GlideEnv, s: GlideState): boolean {
  if (s.phase !== "glide") return false;
  const g = groundBelow(env.walk, s.x, s.y, s.z);
  return (
    g !== null && findLanding(env.walk, s.x, s.z, g, env.radius, 2) !== null
  );
}

/** Stop flying and drop to the ground below (only call when canCancelGlide). */
export function cancelGlide(s: GlideState): void {
  s.phase = "drop";
  s.vy = Math.min(s.vy, 0);
}

/**
 * Advance the glider by dt seconds. Returns what happened: still flying, landed (at the
 * returned standable spot), bumped a cliff (turned back), or a respawn request.
 */
export function stepGlide(
  env: GlideEnv,
  s: GlideState,
  input: GlideInput,
  dt: number
): GlideEvent {
  const { walk, layout } = env;
  s.age += dt;
  const steer = Math.max(-1, Math.min(1, input.steer));
  const pitch = Math.max(-1, Math.min(1, input.pitch));

  // Bank and turn (steering right banks right and turns clockwise from above).
  s.bank = approach(s.bank, steer * GLIDE.bankMax, GLIDE.bankRate * dt);
  // Slower flight turns tighter (like a real wing: rate ~ tan(bank) / speed).
  const tight = GLIDE.speed / Math.max(3, s.speed);
  s.heading -= (s.bank / GLIDE.bankMax) * GLIDE.turnRate * tight * dt;

  if (s.phase === "glide") {
    const speed =
      pitch >= 0
        ? lerp(GLIDE.speed, GLIDE.diveSpeed, pitch)
        : lerp(GLIDE.speed, GLIDE.flareSpeed, -pitch);
    const sink =
      pitch >= 0
        ? lerp(GLIDE.sink, GLIDE.diveSink, pitch)
        : lerp(GLIDE.sink, GLIDE.flareSink, -pitch);
    s.speed = approach(s.speed, speed, GLIDE.accel * dt);
    let lift = thermalLift(layout.thermals, s.x, s.y, s.z);
    if (s.age < GLIDE.launchTime)
      lift += GLIDE.launchLift * (1 - s.age / GLIDE.launchTime);
    const want = Math.min(GLIDE.maxClimb, lift - sink);
    s.vy += (want - s.vy) * (1 - Math.exp(-GLIDE.vyRate * dt));
  } else {
    s.speed = approach(s.speed, 0, 6 * dt);
    s.vy = Math.max(-14, s.vy - GLIDE.dropG * dt);
  }

  const nx = s.x + Math.sin(s.heading) * s.speed * dt;
  const nz = s.z + Math.cos(s.heading) * s.speed * dt;
  const ny = s.y + s.vy * dt;

  // Touching something solid?
  const top = solidTopAt(walk, layout, nx, nz);
  if (Number.isFinite(top) && ny <= top + GLIDE.landGap) {
    // Still climbing off the launch: no landing yet.
    if (top - s.y <= GLIDE.mantle && s.vy <= 0.5) {
      const g = surfaceAt(walk, nx, nz, top);
      const spot = findLanding(walk, nx, nz, g?.y ?? top, env.radius);
      if (spot) {
        s.x = spot.x;
        s.y = spot.y;
        s.z = spot.z;
        return { kind: "land", ...spot };
      }
    }
    if (top > ny) {
      // A cliff face or a wall: turn back, lose speed, keep the position.
      s.heading += Math.PI;
      s.speed = Math.max(GLIDE.flareSpeed * 0.6, s.speed * 0.4);
      s.vy = Math.min(s.vy, -0.4);
      s.bank = 0;
      s.y = Math.min(s.y, ny);
      return { kind: "bump" };
    }
    // Above water or a crowded spot: skim on, a little higher.
    s.x = nx;
    s.z = nz;
    s.y = Math.max(ny, top + GLIDE.landGap + 0.01);
    s.vy = Math.max(s.vy, 0);
    return { kind: "fly" };
  }

  // A bridge deck (not a solid column) can be landed on too.
  const deck = surfaceAt(walk, nx, nz, ny);
  if (deck?.bridgeId && ny <= deck.y + GLIDE.landGap && ny >= deck.y - 0.5) {
    const spot = findLanding(walk, nx, nz, deck.y, env.radius);
    if (spot) {
      s.x = spot.x;
      s.y = spot.y;
      s.z = spot.z;
      return { kind: "land", ...spot };
    }
  }

  s.x = nx;
  s.y = ny;
  s.z = nz;
  if (
    s.y < layout.killY ||
    Math.hypot(s.x - layout.centre.x, s.z - layout.centre.z) > layout.radius
  )
    return { kind: "respawn" };
  return { kind: "fly" };
}
