/**
 * The hot-air balloon, pure logic: the world as a "how low may the balloon be here"
 * height field (island columns, buildings and props with their footprints, lookouts,
 * launch platforms, bridge decks, the zipline cables and posts), the free-flight step
 * (burner, vent, drift with inertia, wind, an altitude floor and ceiling), the autopilot
 * (climb, cruise, descend onto a parking spot), the landing finder, and the scenic tour
 * path, precomputed once and validated against the same height field. No three or react
 * imports.
 *
 * The balloon is modelled as a basket (a short disc at its floor) and an envelope (a wide
 * column from a few metres above the floor). Everything solid in the world is a column
 * too (islands hang below their tops), so "never pass through anything" is exactly
 * "the floor never goes below `need(x, z)`", and moving straight at an altitude above the
 * highest `need` along the way is always safe.
 */

import { canStand } from "../logic/collision";
import { hexKey } from "../logic/hex";
import type { MovementLayout } from "../logic/movement-layout";
import type { Island3D, Manifest } from "../logic/types";
import {
  cellAtWorld,
  cellHeightAt,
  obstacleDistance,
} from "../logic/walk-grid";
import {
  bridgeHeightAt,
  obstaclesNear,
  surfaceAt,
  type BridgeCorridor,
  type WalkWorld,
} from "../logic/walk-world";
import type { Zipline } from "../logic/zipline";

export const BALLOON = {
  /** Basket half-width (corner radius ~0.92). */
  basketHalf: 0.65,
  /** Collision radius of the basket and its clearance over props, decks and cables. */
  basketR: 0.9,
  clearObj: 0.45,
  /** The envelope column: from this far above the floor, this wide, up to `envTop`. */
  envBottom: 3.3,
  envR: 3.6,
  envTop: 11.1,
  clearEnv: 0.5,
  /** Burner climb and vent descent (m/s), and the vertical response (1/s). */
  climb: 1.3,
  vent: 1.0,
  vyRate: 0.9,
  /** Horizontal drift: top speed (m/s) and its response (1/s, slow: inertia). */
  maxSpeed: 4,
  accel: 0.8,
  /** Wind push (m/s): calm, plus gusts and rain. */
  windBase: 0.3,
  windGust: 1.1,
  windRain: 0.5,
  /** Over the void the floor stays this far above the highest island top. */
  voidLift: 1.5,
  /** The ceiling, above the highest island top. */
  ceilingAbove: 34,
  /** E lands when the basket is at most this far above open ground. */
  landHeight: 3.5,
  /** How far around the basket to look for a parking spot (m). */
  landRange: 3.5,
  /** Autopilot cruise clearance and horizontal speed. */
  autoClear: 1.2,
  autoSpeed: 3.2,
  /** Autopilot descent (m/s): a little brisker than the vent, still gentle. */
  autoVent: 1.5,
  /** Scenic tour: clearance over the height field, duration, vertical speed limit. */
  tourClear: 2.2,
  tourSeconds: 105,
  tourVert: 1.4,
} as const;

/** Wind direction (matches the foliage sway: mostly +x, a little +z). */
export const WIND_DIR = { x: 0.857, z: 0.514 } as const;

/** Flat props lower than this are ignored (path stones, decals, tufts). */
const FLAT = 0.3;
const BUCKET = 4;
/** Crane jibs swing around their mast: treat the mast as this wide (m) and this tall. */
const CRANE = { model: "v2-crane-mast", radius: 5.4, extra: 1.7 } as const;

type Circle = {
  x: number;
  z: number;
  r: number;
  top: number;
  terrain: boolean;
};

export type Parking = {
  x: number;
  /** Ground height (the basket floor rests here). */
  y: number;
  z: number;
  islandId: string;
  /** Where the walker steps out. */
  exit: { x: number; y: number; z: number };
};

export type BalloonIsland = {
  id: string;
  x: number;
  z: number;
  radius: number;
  /** Highest walkable top. */
  top: number;
  /** The island's landmark (its tallest object). */
  landmark: { x: number; z: number; top: number };
  /** An open landing spot, as close to the island's middle as possible. */
  landing: Parking | null;
};

export type BalloonEnv = {
  walk: WalkWorld;
  circles: Circle[];
  buckets: Map<number, number[]>;
  maxCircleR: number;
  bridges: readonly BridgeCorridor[];
  cables: readonly Zipline[];
  islands: BalloonIsland[];
  /** Highest walkable island top. */
  topY: number;
  voidFloor: number;
  ceiling: number;
  centre: { x: number; z: number };
  radius: number;
  walkerRadius: number;
  /** Spots the basket keeps away from (doors, mayors, the car's spawn): x, z, radius. */
  keepClear: { x: number; z: number; r: number }[];
};

function bucketKey(ix: number, iz: number): number {
  return (ix + 2048) * 4096 + (iz + 2048);
}

function addCircle(env: BalloonEnv, c: Circle): void {
  const i = env.circles.length;
  env.circles.push(c);
  env.maxCircleR = Math.max(env.maxCircleR, c.r);
  const x0 = Math.floor((c.x - c.r) / BUCKET);
  const x1 = Math.floor((c.x + c.r) / BUCKET);
  const z0 = Math.floor((c.z - c.r) / BUCKET);
  const z1 = Math.floor((c.z + c.r) / BUCKET);
  for (let ix = x0; ix <= x1; ix++)
    for (let iz = z0; iz <= z1; iz++) {
      const k = bucketKey(ix, iz);
      let list = env.buckets.get(k);
      if (!list) {
        list = [];
        env.buckets.set(k, list);
      }
      list.push(i);
    }
}

/**
 * The highest top of the circles touching a disc: `kind` 0 everything, 1 the terrain
 * (island columns), 2 everything else (buildings, props, towers, posts).
 */
export function discTop(
  env: BalloonEnv,
  x: number,
  z: number,
  r: number,
  kind: 0 | 1 | 2 = 0
): number {
  let top = -Infinity;
  const x0 = Math.floor((x - r) / BUCKET);
  const x1 = Math.floor((x + r) / BUCKET);
  const z0 = Math.floor((z - r) / BUCKET);
  const z1 = Math.floor((z + r) / BUCKET);
  for (let ix = x0; ix <= x1; ix++)
    for (let iz = z0; iz <= z1; iz++) {
      const list = env.buckets.get(bucketKey(ix, iz));
      if (!list) continue;
      for (let j = 0; j < list.length; j++) {
        const c = env.circles[list[j] as number] as Circle;
        if (c.top <= top) continue;
        if (kind === 1 && !c.terrain) continue;
        if (kind === 2 && c.terrain) continue;
        const dx = c.x - x;
        const dz = c.z - z;
        const reach = c.r + r;
        if (dx * dx + dz * dz <= reach * reach) top = c.top;
      }
    }
  return top;
}

const RING8 = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)] as const;
});

/** The island terrain under a small disc (its centre and eight rim points, exact hexes). */
export function terrainTop(
  env: BalloonEnv,
  x: number,
  z: number,
  r: number
): number {
  let top = -Infinity;
  for (let i = -1; i < 8; i++) {
    const d = i < 0 ? null : (RING8[i] as readonly [number, number]);
    const px = d ? x + d[0] * r : x;
    const pz = d ? z + d[1] * r : z;
    for (const grid of env.walk.islands) {
      const c = cellAtWorld(grid, px, pz);
      if (!c) continue;
      const t = c.water
        ? c.y
        : c.slope
          ? cellHeightAt(c, px, pz, grid.hexWidth)
          : c.y;
      if (t > top) top = t;
    }
  }
  return top;
}

/** Bridge decks (with their rails and posts) touching a disc. */
export function bridgeTop(
  env: BalloonEnv,
  x: number,
  z: number,
  r: number
): number {
  let top = -Infinity;
  for (const b of env.bridges) {
    const dx = b.b.x - b.a.x;
    const dz = b.b.z - b.a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.min(
      b.t1,
      Math.max(b.t0, ((x - b.a.x) * dx + (z - b.a.z) * dz) / len2)
    );
    const px = b.a.x + dx * t;
    const pz = b.a.z + dz * t;
    if (Math.hypot(x - px, z - pz) > b.halfWidth + 0.5 + r) continue;
    const span = (r + b.halfWidth) / Math.sqrt(len2);
    const h = Math.max(
      bridgeHeightAt(b, t),
      bridgeHeightAt(b, Math.max(b.t0, t - span)),
      bridgeHeightAt(b, Math.min(b.t1, t + span))
    );
    top = Math.max(top, h + 1.8);
  }
  return top;
}

/** Zipline cables touching a disc. */
export function cableTop(
  env: BalloonEnv,
  x: number,
  z: number,
  r: number
): number {
  let top = -Infinity;
  for (const c of env.cables) {
    const dx = c.b.x - c.a.x;
    const dz = c.b.z - c.a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.min(
      1,
      Math.max(0, ((x - c.a.x) * dx + (z - c.a.z) * dz) / len2)
    );
    const px = c.a.x + dx * t;
    const pz = c.a.z + dz * t;
    if (Math.hypot(x - px, z - pz) > r + 0.2) continue;
    // The cable is highest at its start end: take the highest point within reach.
    const span = r / Math.sqrt(len2);
    const t0 = Math.max(0, t - span);
    top = Math.max(top, c.a.y + (c.b.y - c.a.y) * t0 + 0.25);
  }
  return top;
}

/**
 * The lowest the balloon's floor may be at (x, z): the basket resting on the terrain
 * (no margin, so it can land) and clear of props, decks and cables, and the envelope
 * clear of everything. -Infinity over the open void.
 */
export function need(env: BalloonEnv, x: number, z: number): number {
  const rb = BALLOON.basketR;
  const re = BALLOON.envR;
  const basket = Math.max(
    terrainTop(env, x, z, rb),
    Math.max(
      discTop(env, x, z, rb, 2),
      bridgeTop(env, x, z, rb),
      cableTop(env, x, z, rb)
    ) + BALLOON.clearObj
  );
  const envelope =
    Math.max(
      discTop(env, x, z, re, 0),
      bridgeTop(env, x, z, re),
      cableTop(env, x, z, re)
    ) +
    BALLOON.clearEnv -
    BALLOON.envBottom;
  return Math.max(basket, envelope);
}

/** Whether any island lies under the basket. */
export function overIsland(env: BalloonEnv, x: number, z: number): boolean {
  return Number.isFinite(terrainTop(env, x, z, BALLOON.basketR));
}

/** The free-flight floor: `need`, and over the void the void floor. */
export function floorAt(env: BalloonEnv, x: number, z: number): number {
  const n = need(env, x, z);
  return overIsland(env, x, z) ? n : Math.max(n, env.voidFloor);
}

/** The highest `need` along a straight line (sampled every half metre). */
export function maxNeedAlong(
  env: BalloonEnv,
  x0: number,
  z0: number,
  x1: number,
  z1: number
): number {
  const d = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.ceil(d / 0.5));
  let m = -Infinity;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    m = Math.max(m, need(env, x0 + (x1 - x0) * k, z0 + (z1 - z0) * k));
  }
  return m;
}

/** A parking spot exactly at (x, z), or null (no ground, crowded, no room to step out). */
export function parkingAt(
  env: BalloonEnv,
  x: number,
  z: number
): Parking | null {
  const s = surfaceAt(env.walk, x, z);
  if (!s || !s.islandId || !s.cell || s.cell.water) return null;
  const n = need(env, x, z);
  if (n > s.y + 0.02) return null;
  const rb = BALLOON.basketR;
  for (const k of env.keepClear)
    if (Math.hypot(x - k.x, z - k.z) < k.r + rb) return null;
  for (const o of obstaclesNear(env.walk, x, z, rb))
    if (obstacleDistance(o, x, z) < rb) return null;
  const d = rb + env.walkerRadius + 0.35;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const ex = x + Math.cos(a) * d;
    const ez = z + Math.sin(a) * d;
    const st = canStand(env.walk, ex, ez, env.walkerRadius, s.y);
    if (st && !st.bridgeId)
      return {
        x,
        // Rest on the highest ground under the basket (gentle bumps).
        y: Math.max(s.y, n),
        z,
        islandId: s.islandId,
        exit: { x: ex, y: st.y, z: ez },
      };
  }
  return null;
}

/** The nearest parking spot around (x, z) within `range` metres, or null. */
export function findParking(
  env: BalloonEnv,
  x: number,
  z: number,
  range: number = BALLOON.landRange,
  step = 0.5
): Parking | null {
  const here = parkingAt(env, x, z);
  if (here) return here;
  for (let ring = step; ring <= range + 1e-6; ring += step) {
    const n = Math.max(8, Math.round(ring * 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = parkingAt(env, x + Math.cos(a) * ring, z + Math.sin(a) * ring);
      if (p) return p;
    }
  }
  return null;
}

/**
 * Build the balloon's view of the world. `field` is the launch field (home's), used as
 * home's landing spot.
 */
export function buildBalloonEnv(
  islands: readonly Island3D[],
  walk: WalkWorld,
  layout: Pick<
    MovementLayout,
    "lookouts" | "launches" | "ziplines" | "centre" | "radius"
  >,
  manifest: Manifest | null,
  walkerRadius: number,
  keepClear: BalloonEnv["keepClear"] = []
): BalloonEnv {
  const env: BalloonEnv = {
    walk,
    circles: [],
    buckets: new Map(),
    maxCircleR: 0,
    bridges: walk.bridges,
    cables: layout.ziplines,
    islands: [],
    topY: 0,
    voidFloor: 0,
    ceiling: 0,
    centre: layout.centre,
    radius: layout.radius,
    walkerRadius,
    keepClear,
  };
  let topY = -Infinity;
  for (const grid of walk.islands) {
    const island = islands.find((i) => i.id === grid.islandId);
    let radius = 0;
    let top = -Infinity;
    for (const c of grid.cells.values()) {
      const t = c.slope ? Math.max(c.y, c.slope.lowY + c.slope.rise) : c.y;
      addCircle(env, { x: c.x, z: c.z, r: grid.size, top: t, terrain: true });
      radius = Math.max(
        radius,
        Math.hypot(c.x - grid.origin.x, c.z - grid.origin.z) + grid.size
      );
      if (!c.water && c.ground) top = Math.max(top, c.y);
    }
    if (!Number.isFinite(top)) top = grid.baseY;
    topY = Math.max(topY, top);
    let landmark = { x: grid.origin.x, z: grid.origin.z, top };
    for (const obj of island?.objects ?? []) {
      const cell = grid.cells.get(hexKey(obj.q, obj.r));
      if (!cell) continue;
      const m = manifest?.models[obj.model];
      const sc = obj.scale ?? 1;
      const size = m?.size ?? [1.2, 2.5, 1.2];
      const h = (size[1] ?? 2.5) * sc;
      if (h < FLAT) continue;
      const x = cell.x + (obj.offset?.[0] ?? 0);
      const z = cell.z + (obj.offset?.[1] ?? 0);
      const r = (Math.hypot(size[0] ?? 1, size[2] ?? 1) / 2) * sc;
      const objTop = cell.y + h;
      addCircle(env, { x, z, r, top: objTop, terrain: false });
      if (obj.model === CRANE.model)
        addCircle(env, {
          x,
          z,
          r: CRANE.radius * sc,
          top: objTop + CRANE.extra,
          terrain: false,
        });
      if (objTop > landmark.top) landmark = { x, z, top: objTop };
    }
    env.islands.push({
      id: grid.islandId,
      x: grid.origin.x,
      z: grid.origin.z,
      radius,
      top,
      landmark,
      landing: null,
    });
  }
  for (const l of layout.lookouts)
    addCircle(env, { x: l.x, z: l.z, r: 1.3, top: l.y + 1.2, terrain: false });
  for (const l of layout.launches)
    addCircle(env, { x: l.x, z: l.z, r: 1.3, top: l.y + 2.6, terrain: false });
  for (const zl of layout.ziplines) {
    addCircle(env, {
      x: zl.a.x,
      z: zl.a.z,
      r: 1.1,
      top: zl.a.y + 0.4,
      terrain: false,
    });
    addCircle(env, {
      x: zl.b.x,
      z: zl.b.z,
      r: 1.1,
      top: zl.b.y + 0.4,
      terrain: false,
    });
  }
  env.topY = Number.isFinite(topY) ? topY : 0;
  env.voidFloor = env.topY + BALLOON.voidLift;
  env.ceiling = env.topY + BALLOON.ceilingAbove;
  return env;
}

/** Fill each island's landing spot: the open spot nearest its middle (home: the field). */
export function findIslandLandings(
  env: BalloonEnv,
  field: Parking | null
): void {
  for (const isl of env.islands) {
    if (field && field.islandId === isl.id) {
      isl.landing = field;
      continue;
    }
    isl.landing = findParking(env, isl.x, isl.z, isl.radius, 0.5);
  }
}

// ---------------------------------------------------------------- free flight

export type BalloonState = {
  x: number;
  /** Basket floor. */
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  heading: number;
  /** Burner flame 0..1 (eased). */
  burn: number;
  /** The floor forced a burn this step. */
  autoBurn: boolean;
};

export type FreeInput = {
  /** +1 burner (climb) .. -1 vent (descend). */
  lift: number;
  /** World-space drift wish (length <= 1). */
  dx: number;
  dz: number;
};

export type FreeEvent = { blocked: boolean; ceiling: boolean };

export function createBalloonState(
  x: number,
  y: number,
  z: number,
  heading = 0
): BalloonState {
  return {
    x,
    y,
    z,
    vx: 0,
    vz: 0,
    vy: 0,
    heading,
    burn: 0,
    autoBurn: false,
  };
}

/** The wind push (m/s) for a gust 0..1 and rain 0..1, written into `out`. */
export function windAt(
  gust: number,
  rain: number,
  out: { x: number; z: number }
): { x: number; z: number } {
  const m =
    BALLOON.windBase + BALLOON.windGust * gust + BALLOON.windRain * rain;
  out.x = WIND_DIR.x * m;
  out.z = WIND_DIR.z * m;
  return out;
}

function ease(v: number, target: number, rate: number, dt: number): number {
  return v + (target - v) * (1 - Math.exp(-rate * dt));
}

function turnTowards(h: number, want: number, max: number): number {
  let d = (want - h) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return h + Math.max(-max, Math.min(max, d));
}

const EV: FreeEvent = { blocked: false, ceiling: false };

/**
 * One free-flight step: the burner climbs, the vent sinks, the drift eases towards the
 * wish (slowly: inertia) and the wind adds a push. Never below `need` (a horizontal move
 * into something higher is refused, sliding along one axis if it can), never below the
 * void floor (it burns on its own), never above the ceiling. Returns a shared event.
 */
export function stepFree(
  env: BalloonEnv,
  s: BalloonState,
  input: FreeInput,
  wind: { x: number; z: number },
  dt: number
): FreeEvent {
  EV.blocked = false;
  EV.ceiling = false;
  const lift = Math.max(-1, Math.min(1, input.lift));
  const floor = floorAt(env, s.x, s.z);
  let want = lift > 0 ? lift * BALLOON.climb : lift * BALLOON.vent;
  s.autoBurn = s.y < floor + 0.6;
  if (s.autoBurn) want = Math.max(want, BALLOON.climb * 0.8);
  if (s.y >= env.ceiling - 0.05) want = Math.min(want, 0);
  s.vy = ease(s.vy, want, BALLOON.vyRate, dt);
  const ny = Math.min(
    env.ceiling,
    Math.max(need(env, s.x, s.z), s.y + s.vy * dt)
  );
  if (ny >= env.ceiling - 0.01) {
    EV.ceiling = true;
    s.vy = Math.min(0, s.vy);
  }
  s.y = ny;

  const len = Math.hypot(input.dx, input.dz);
  const k = len > 1 ? 1 / len : 1;
  s.vx = ease(s.vx, input.dx * k * BALLOON.maxSpeed, BALLOON.accel, dt);
  s.vz = ease(s.vz, input.dz * k * BALLOON.maxSpeed, BALLOON.accel, dt);
  let tx = s.vx + wind.x;
  let tz = s.vz + wind.z;
  // Stay over the archipelago: no drift further out.
  const ox = s.x - env.centre.x;
  const oz = s.z - env.centre.z;
  const od = Math.hypot(ox, oz);
  if (od > env.radius - 4) {
    const out = (tx * ox + tz * oz) / (od || 1);
    if (out > 0) {
      tx -= (out * ox) / od;
      tz -= (out * oz) / od;
    }
  }
  const nx = s.x + tx * dt;
  const nz = s.z + tz * dt;
  if (need(env, nx, nz) <= s.y) {
    s.x = nx;
    s.z = nz;
  } else if (need(env, nx, s.z) <= s.y) {
    s.x = nx;
    s.vz = 0;
    EV.blocked = true;
  } else if (need(env, s.x, nz) <= s.y) {
    s.z = nz;
    s.vx = 0;
    EV.blocked = true;
  } else {
    s.vx = 0;
    s.vz = 0;
    EV.blocked = true;
  }
  const sp = Math.hypot(s.vx, s.vz);
  if (sp > 0.4)
    s.heading = turnTowards(s.heading, Math.atan2(s.vx, s.vz), 0.5 * dt);
  s.burn = ease(s.burn, lift > 0 || s.autoBurn ? 1 : 0, 6, dt);
  return EV;
}

/** Whether E may land now: low over island ground. */
export function canTryLanding(env: BalloonEnv, s: BalloonState): boolean {
  const g = surfaceAt(env.walk, s.x, s.z);
  return (
    g !== null &&
    g.islandId !== null &&
    s.y - g.y <= BALLOON.landHeight &&
    s.y >= g.y - 0.1
  );
}

// ---------------------------------------------------------------- autopilot

export type Autopilot = {
  tx: number;
  ty: number;
  tz: number;
  cruise: number;
  stage: "climb" | "travel" | "descend";
};

/** Fly to a parking spot: up to a safe cruise height, straight across, gently down. */
export function startAutopilot(
  env: BalloonEnv,
  s: BalloonState,
  to: { x: number; y: number; z: number }
): Autopilot {
  const cruise = Math.min(
    env.ceiling,
    Math.max(
      s.y,
      to.y,
      maxNeedAlong(env, s.x, s.z, to.x, to.z) + BALLOON.autoClear
    )
  );
  return {
    tx: to.x,
    ty: to.y,
    tz: to.z,
    cruise,
    stage: s.y < cruise - 0.05 ? "climb" : "travel",
  };
}

/** Advance the autopilot; true once landed on the target. */
export function stepAutopilot(
  s: BalloonState,
  a: Autopilot,
  dt: number
): boolean {
  if (a.stage === "climb") {
    s.vy = ease(s.vy, BALLOON.climb, 2, dt);
    s.y = Math.min(a.cruise, s.y + Math.max(0.2, s.vy) * dt);
    s.burn = ease(s.burn, 1, 6, dt);
    if (s.y >= a.cruise - 1e-3) a.stage = "travel";
    return false;
  }
  if (a.stage === "travel") {
    s.vy = ease(s.vy, 0, 2, dt);
    s.burn = ease(s.burn, 0.15, 3, dt);
    const dx = a.tx - s.x;
    const dz = a.tz - s.z;
    const d = Math.hypot(dx, dz);
    const sp = Math.min(BALLOON.autoSpeed, d * 0.7 + 0.3);
    const step = sp * dt;
    if (d <= step) {
      s.x = a.tx;
      s.z = a.tz;
      s.vx = 0;
      s.vz = 0;
      a.stage = "descend";
    } else {
      s.vx = (dx / d) * sp;
      s.vz = (dz / d) * sp;
      s.x += (dx / d) * step;
      s.z += (dz / d) * step;
      s.heading = turnTowards(s.heading, Math.atan2(dx, dz), 0.6 * dt);
    }
    return false;
  }
  const left = s.y - a.ty;
  const rate = Math.min(BALLOON.autoVent, left * 0.7 + 0.25);
  s.vy = -rate;
  s.burn = ease(s.burn, left < 1.2 ? 0.6 : 0.1, 4, dt);
  s.y = Math.max(a.ty, s.y - rate * dt);
  if (s.y <= a.ty + 1e-4) {
    s.vy = 0;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- scenic tour

export type TourPath = {
  n: number;
  xs: Float64Array;
  ys: Float64Array;
  zs: Float64Array;
  /** Time (s) at each sample, increasing from 0 to `duration`. */
  ts: Float64Array;
  duration: number;
  /** When the tour passes closest to each island. */
  passes: { islandId: string; t: number }[];
};

type Way = { x: number; z: number; y: number };

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * The scenic tour: up from the field, a loop around the outer islands in order of their
 * bearing (passing just outside each landmark), up high over the void between them, a
 * last high pass over home's middle for the panorama, and back down onto the field.
 * Sampled every ~0.5 m, held `tourClear` above the height field, smoothed, timed to
 * about `tourSeconds`.
 */
export function buildTour(
  env: BalloonEnv,
  field: Parking,
  homeId = field.islandId
): TourPath {
  const c = env.centre;
  const home = env.islands.find((i) => i.id === homeId);
  const fieldAngle = Math.atan2(field.z - c.z, field.x - c.x);
  const outer = env.islands
    .filter((i) => i.id !== homeId)
    .map((i) => {
      let a = Math.atan2(i.z - c.z, i.x - c.x) - fieldAngle;
      while (a < 0) a += Math.PI * 2;
      return { i, a };
    })
    .sort((p, q) => p.a - q.a)
    .map((p) => p.i);

  const high = env.topY + 15;
  const ways: Way[] = [{ x: field.x, z: field.z, y: field.y + 9 }];
  let prev: Way = ways[0] as Way;
  for (const isl of outer) {
    const L = isl.landmark;
    let ox = L.x - c.x;
    let oz = L.z - c.z;
    const od = Math.hypot(ox, oz) || 1;
    ox /= od;
    oz /= od;
    const w: Way = { x: L.x + ox * 5, z: L.z + oz * 5, y: L.top + 9 };
    // Over the void between islands: up high for the view.
    const mx = (prev.x + w.x) / 2;
    const mz = (prev.z + w.z) / 2;
    const mo = Math.hypot(mx - c.x, mz - c.z) || 1;
    const push = Math.max(0, 22 - mo);
    ways.push({
      x: mx + ((mx - c.x) / mo) * push,
      z: mz + ((mz - c.z) / mo) * push,
      y: high,
    });
    ways.push(w);
    prev = w;
  }
  const hx = home?.x ?? c.x;
  const hz = home?.z ?? c.z;
  ways.push({ x: (prev.x + hx) / 2, z: (prev.z + hz) / 2, y: high + 4 });
  ways.push({ x: hx, z: hz, y: env.topY + 24 });
  // Approach the field from home's middle.
  ways.push({
    x: field.x + (hx - field.x) * 0.35,
    z: field.z + (hz - field.z) * 0.35,
    y: field.y + 12,
  });
  ways.push({ x: field.x, z: field.z, y: field.y + 8 });

  // Dense samples along a Catmull-Rom curve through the waypoints.
  const px: number[] = [];
  const pz: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < ways.length - 1; i++) {
    const w0 = ways[Math.max(0, i - 1)] as Way;
    const w1 = ways[i] as Way;
    const w2 = ways[i + 1] as Way;
    const w3 = ways[Math.min(ways.length - 1, i + 2)] as Way;
    const len = Math.hypot(w2.x - w1.x, w2.z - w1.z);
    const steps = Math.max(2, Math.ceil(len / 0.5));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      px.push(catmull(w0.x, w1.x, w2.x, w3.x, t));
      pz.push(catmull(w0.z, w1.z, w2.z, w3.z, t));
      const sm = t * t * (3 - 2 * t);
      py.push(w1.y + (w2.y - w1.y) * sm);
    }
  }
  const last = ways[ways.length - 1] as Way;
  px.push(last.x);
  pz.push(last.z);
  py.push(last.y);
  const m = px.length;
  const floor = new Float64Array(m);
  for (let i = 0; i < m; i++)
    floor[i] = Math.max(
      need(env, px[i] as number, pz[i] as number) + BALLOON.tourClear,
      floorAt(env, px[i] as number, pz[i] as number) + 1
    );
  const ys = new Float64Array(m);
  for (let i = 0; i < m; i++)
    ys[i] = Math.max(py[i] as number, floor[i] as number);
  // Raise the lows ahead of and behind obstacles (a gentle slope), then smooth.
  const slope = 0.32;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < m; i++) {
      const d = Math.hypot(
        (px[i] as number) - (px[i - 1] as number),
        (pz[i] as number) - (pz[i - 1] as number)
      );
      ys[i] = Math.max(ys[i] as number, (ys[i - 1] as number) - slope * d);
    }
    for (let i = m - 2; i >= 0; i--) {
      const d = Math.hypot(
        (px[i] as number) - (px[i + 1] as number),
        (pz[i] as number) - (pz[i + 1] as number)
      );
      ys[i] = Math.max(ys[i] as number, (ys[i + 1] as number) - slope * d);
    }
    const sm = new Float64Array(m);
    const W = 6;
    for (let i = 0; i < m; i++) {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(0, i - W); j <= Math.min(m - 1, i + W); j++) {
        sum += ys[j] as number;
        n++;
      }
      sm[i] = Math.max(sum / n, (floor[i] as number) - 0.4);
    }
    ys.set(sm);
  }

  // Vertical climb from the field and the final descent onto it.
  const fx: number[] = [];
  const fz: number[] = [];
  const fy: number[] = [];
  const startY = ys[0] as number;
  for (let y = field.y; y < startY; y += 0.4) {
    fx.push(field.x);
    fz.push(field.z);
    fy.push(y);
  }
  for (let i = 0; i < m; i++) {
    fx.push(px[i] as number);
    fz.push(pz[i] as number);
    fy.push(ys[i] as number);
  }
  for (let y = (ys[m - 1] as number) - 0.4; y > field.y; y -= 0.4) {
    fx.push(field.x);
    fz.push(field.z);
    fy.push(y);
  }
  fx.push(field.x);
  fz.push(field.z);
  fy.push(field.y);

  const n = fx.length;
  const xs = Float64Array.from(fx);
  const zs = Float64Array.from(fz);
  const yv = Float64Array.from(fy);
  // Horizontal distance from the start and to the end (for easing in and out).
  const along = new Float64Array(n);
  for (let i = 1; i < n; i++)
    along[i] =
      (along[i - 1] as number) +
      Math.hypot(
        (xs[i] as number) - (xs[i - 1] as number),
        (zs[i] as number) - (zs[i - 1] as number)
      );
  const total = along[n - 1] as number;
  const timeFor = (vh: number, out: Float64Array | null): number => {
    let t = 0;
    if (out) out[0] = 0;
    for (let i = 1; i < n; i++) {
      const dh = (along[i] as number) - (along[i - 1] as number);
      const dv = Math.abs((yv[i] as number) - (yv[i - 1] as number));
      const a = along[i] as number;
      const k = Math.max(0.3, Math.min(1, a / 10, (total - a) / 10));
      // Ease off the vertical rate right at the ground.
      const ground = Math.min(
        1,
        Math.max(0.35, ((yv[i] as number) - field.y) / 1.5)
      );
      t += Math.max(dh / (vh * k), dv / (BALLOON.tourVert * ground), 1e-3);
      if (out) out[i] = t;
    }
    return t;
  };
  let lo = 0.5;
  let hi = 12;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (timeFor(mid, null) > BALLOON.tourSeconds) lo = mid;
    else hi = mid;
  }
  const ts = new Float64Array(n);
  const duration = timeFor(hi, ts);

  const passes = outer.map((isl) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(
        (xs[i] as number) - isl.x,
        (zs[i] as number) - isl.z
      );
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return { islandId: isl.id, t: ts[best] as number };
  });
  if (home) {
    let best = 0;
    let bd = Infinity;
    for (let i = Math.floor(n / 2); i < n; i++) {
      const d = Math.hypot(
        (xs[i] as number) - home.x,
        (zs[i] as number) - home.z
      );
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    passes.push({ islandId: home.id, t: ts[best] as number });
  }
  return { n, xs, ys: yv, zs, ts, duration, passes };
}

/** The tour position at time t (seconds), written into `out`; `hint` speeds the lookup. */
export function tourPoint(
  path: TourPath,
  t: number,
  out: { x: number; y: number; z: number },
  hint = 0
): number {
  const { ts, n } = path;
  let i = Math.max(0, Math.min(n - 2, hint));
  const c = Math.max(0, Math.min(path.duration, t));
  while (i > 0 && (ts[i] as number) > c) i--;
  while (i < n - 2 && (ts[i + 1] as number) < c) i++;
  const t0 = ts[i] as number;
  const t1 = ts[i + 1] as number;
  const k = t1 > t0 ? (c - t0) / (t1 - t0) : 1;
  out.x =
    (path.xs[i] as number) +
    ((path.xs[i + 1] as number) - (path.xs[i] as number)) * k;
  out.y =
    (path.ys[i] as number) +
    ((path.ys[i + 1] as number) - (path.ys[i] as number)) * k;
  out.z =
    (path.zs[i] as number) +
    ((path.zs[i + 1] as number) - (path.zs[i] as number)) * k;
  return i;
}

/** The island whose name shows at tour time t (within a few seconds of passing it). */
export function tourLabel(
  path: TourPath,
  t: number,
  window = 6
): string | null {
  for (const p of path.passes)
    if (Math.abs(t - p.t) < window) return p.islandId;
  return null;
}

/**
 * Where an early exit from the tour lands: over (or next to) an island, that island's
 * landing spot; over the void, the field.
 */
export function exitTarget(
  env: BalloonEnv,
  x: number,
  z: number,
  field: Parking
): Parking {
  let best: BalloonIsland | null = null;
  let bd = Infinity;
  for (const isl of env.islands) {
    const d = Math.hypot(x - isl.x, z - isl.z) - isl.radius;
    if (d < bd) {
      bd = d;
      best = isl;
    }
  }
  if (!best || bd > 1) return field;
  if (best.landing) return best.landing;
  // A crowded island with no room: the nearest island that has a landing spot.
  let spot: Parking = field;
  let sd = Math.hypot(x - field.x, z - field.z);
  for (const isl of env.islands) {
    if (!isl.landing) continue;
    const d = Math.hypot(x - isl.landing.x, z - isl.landing.z);
    if (d < sd) {
      sd = d;
      spot = isl.landing;
    }
  }
  return spot;
}

/** Put the parked basket into the walk world as an obstacle (null: none, it is flying). */
export function syncBalloonObstacle(
  walk: WalkWorld,
  park: { x: number; z: number } | null
): void {
  const dyn = walk.dynamic.filter((o) => o.source !== "balloon");
  if (park)
    dyn.push({
      shape: "circle",
      x: park.x,
      z: park.z,
      radius: BALLOON.basketHalf + 0.15,
      source: "balloon",
    });
  walk.dynamic = dyn;
}

/** Boarding is for walkers only (not driving, gliding, riding or in a menu). */
export function canBoard(
  mode: string,
  driving: boolean,
  frozen: boolean
): boolean {
  return mode === "walk" && !driving && !frozen;
}

/** The launch field from the islands' `movement.balloon`, as a parking spot. */
export function fieldSpot(
  env: BalloonEnv,
  islands: readonly Island3D[]
): { spot: Parking; heading: number } | null {
  for (const island of islands) {
    const f = island.movement?.balloon;
    if (!f) continue;
    const grid = env.walk.islands.find((g) => g.islandId === island.id);
    const cell = grid?.cells.get(hexKey(f.q, f.r));
    if (!cell) continue;
    const spot = findParking(env, cell.x, cell.z, 1.5, 0.25);
    if (spot) return { spot, heading: ((f.rot ?? 0) * Math.PI) / 180 };
  }
  return null;
}

export type BalloonWorld = {
  env: BalloonEnv;
  field: Parking;
  fieldHeading: number;
  tour: TourPath;
};

/** Everything the balloon needs, built once per world (null without a launch field). */
export function buildBalloonWorld(
  world: {
    islands: readonly Island3D[];
    walk: WalkWorld;
    movement: MovementLayout;
    interactables?: readonly {
      kind: string;
      x: number;
      z: number;
      range: number;
    }[];
  },
  manifest: Manifest | null,
  walkerRadius: number
): BalloonWorld | null {
  const env = buildBalloonEnv(
    world.islands,
    world.walk,
    world.movement,
    manifest,
    walkerRadius,
    (world.interactables ?? []).map((i) => ({
      x: i.x,
      z: i.z,
      // Mayors stroll a little around their spot; doors and the car need their prompts.
      r: i.kind === "npc" ? 2 : Math.max(1.2, i.range),
    }))
  );
  const f = fieldSpot(env, world.islands);
  if (!f) return null;
  findIslandLandings(env, f.spot);
  return {
    env,
    field: f.spot,
    fieldHeading: f.heading,
    tour: buildTour(env, f.spot),
  };
}

const toursFrom = new WeakMap<Parking, TourPath>();

/**
 * A scenic tour that takes off from `spot` and lands back on it, still looping past every
 * island and over home's middle. The field's tour is the precomputed one; any other spot's
 * tour is built on first use and cached (a few tens of ms, once).
 */
export function tourFrom(bw: BalloonWorld, spot: Parking): TourPath {
  if (spot === bw.field) return bw.tour;
  let tour = toursFrom.get(spot);
  if (!tour) {
    tour = buildTour(bw.env, spot, bw.field.islandId);
    toursFrom.set(spot, tour);
  }
  return tour;
}
