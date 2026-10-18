/**
 * Invisible rails that keep the car on the walkable area: wall segments along every
 * island rim (edges towards the void, water or unwalkable terrain), open where a bridge
 * leaves the island, and along both sides of every bridge deck. Used by the car
 * controller and as thin static walls in the physics world. Pure: no three imports.
 */

import { HEX_DIRECTIONS, hexKey } from "./hex";
import {
  cellAtWorld,
  isCellWalkable,
  type IslandWalkGrid,
  type WalkCell,
} from "./walk-grid";
import {
  bridgeHeightAt,
  projectOnBridge,
  type BridgeCorridor,
  type WalkWorld,
} from "./walk-world";

export type Rail = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Bottom and top of the wall (world y). */
  y0: number;
  y1: number;
  kind: "rim" | "bridge";
  /** Island id (rim) or bridge id. */
  owner: string;
};

/** Rails rise this far above the ground. */
export const RAIL_HEIGHT = 1.2;
/** Rim edges are split into this many pieces so a bridge mouth can open part of an edge. */
const RIM_PIECES = 3;
/** Bridge rails are cut into pieces of about this length to follow the deck's arch. */
const BRIDGE_PIECE = 0.75;

function corner(cell: WalkCell, size: number, i: number): [number, number] {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [cell.x + Math.cos(a) * size, cell.z + Math.sin(a) * size];
}

/** True when (x, z) lies in a bridge corridor's mouth (where the rim must stay open). */
function inBridgeMouth(
  bridges: readonly BridgeCorridor[],
  x: number,
  z: number
): boolean {
  for (const b of bridges) {
    const { t, dist } = projectOnBridge(b, x, z);
    if (t >= -0.05 && t <= 1.05 && dist <= b.halfWidth + 0.08) return true;
  }
  return false;
}

/** Rim rails of one island. */
export function islandRimRails(
  grid: IslandWalkGrid,
  bridges: readonly BridgeCorridor[]
): Rail[] {
  const mine = bridges.filter(
    (b) => b.from === grid.islandId || b.to === grid.islandId
  );
  const rails: Rail[] = [];
  for (const cell of grid.cells.values()) {
    if (!isCellWalkable(cell)) continue;
    for (let i = 0; i < 6; i++) {
      // Corner i..i+1 faces the neighbour in direction (6 - i) % 6 (as in the terrace walls).
      const dir = HEX_DIRECTIONS[(6 - i) % 6] as { q: number; r: number };
      const n = grid.cells.get(hexKey(cell.q + dir.q, cell.r + dir.r));
      const open =
        n && (n.blocked || isCellWalkable(n)) && !(n.water && !n.deck);
      if (open) continue;
      const [ax, az] = corner(cell, grid.size, i);
      const [bx, bz] = corner(cell, grid.size, i + 1);
      for (let k = 0; k < RIM_PIECES; k++) {
        const t0 = k / RIM_PIECES;
        const t1 = (k + 1) / RIM_PIECES;
        const px = ax + (bx - ax) * t0;
        const pz = az + (bz - az) * t0;
        const qx = ax + (bx - ax) * t1;
        const qz = az + (bz - az) * t1;
        if (inBridgeMouth(mine, (px + qx) / 2, (pz + qz) / 2)) continue;
        rails.push({
          ax: px,
          az: pz,
          bx: qx,
          bz: qz,
          y0: cell.y - 0.6,
          y1: cell.y + RAIL_HEIGHT,
          kind: "rim",
          owner: grid.islandId,
        });
      }
    }
  }
  return mergeCollinear(rails);
}

/** Join consecutive collinear rail pieces (fewer colliders). */
function mergeCollinear(rails: Rail[]): Rail[] {
  const out: Rail[] = [];
  for (const r of rails) {
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(last.bx - r.ax) < 1e-6 &&
      Math.abs(last.bz - r.az) < 1e-6 &&
      Math.abs(last.y1 - r.y1) < 1e-6
    ) {
      const d1x = last.bx - last.ax;
      const d1z = last.bz - last.az;
      const d2x = r.bx - r.ax;
      const d2z = r.bz - r.az;
      if (Math.abs(d1x * d2z - d1z * d2x) < 1e-6 && d1x * d2x + d1z * d2z > 0) {
        last.bx = r.bx;
        last.bz = r.bz;
        continue;
      }
    }
    out.push({ ...r });
  }
  return out;
}

/** Whether a point is on any tile of the bridge's two islands. */
function onEndIsland(
  world: WalkWorld,
  bridge: BridgeCorridor,
  x: number,
  z: number
): boolean {
  return world.islands.some(
    (g) =>
      (g.islandId === bridge.from || g.islandId === bridge.to) &&
      cellAtWorld(g, x, z) !== undefined
  );
}

/** Rails along both sides of a bridge, over the stretch between the two island rims. */
export function bridgeRails(world: WalkWorld, bridge: BridgeCorridor): Rail[] {
  const dx = bridge.b.x - bridge.a.x;
  const dz = bridge.b.z - bridge.a.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const vx = -uz;
  const vz = ux;
  const off = bridge.halfWidth + 0.04;
  const n = Math.max(2, Math.ceil(len / BRIDGE_PIECE));
  const rails: Rail[] = [];
  for (let i = 0; i < n; i++) {
    const ta = i / n;
    const tb = (i + 1) / n;
    for (const side of [-1, 1]) {
      const ax = bridge.a.x + dx * ta + vx * off * side;
      const az = bridge.a.z + dz * ta + vz * off * side;
      const bx = bridge.a.x + dx * tb + vx * off * side;
      const bz = bridge.a.z + dz * tb + vz * off * side;
      // Only where the rail itself hangs over the void (not over the islands' tiles).
      if (
        onEndIsland(world, bridge, ax, az) &&
        onEndIsland(world, bridge, bx, bz)
      )
        continue;
      const y = Math.min(
        bridgeHeightAt(bridge, ta),
        bridgeHeightAt(bridge, tb)
      );
      rails.push({
        ax,
        az,
        bx,
        bz,
        y0: y - 0.6,
        y1:
          Math.max(bridgeHeightAt(bridge, ta), bridgeHeightAt(bridge, tb)) +
          RAIL_HEIGHT,
        kind: "bridge",
        owner: bridge.id,
      });
    }
  }
  return rails;
}

/** Every rail in the world. */
export function buildRails(world: WalkWorld): Rail[] {
  return [
    ...world.islands.flatMap((g) => islandRimRails(g, world.bridges)),
    ...world.bridges.flatMap((b) => bridgeRails(world, b)),
  ];
}

/** Distance from a point to a rail segment (in plan view). */
export function railDistance(rail: Rail, x: number, z: number): number {
  const dx = rail.bx - rail.ax;
  const dz = rail.bz - rail.az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.min(
    1,
    Math.max(0, ((x - rail.ax) * dx + (z - rail.az) * dz) / len2)
  );
  return Math.hypot(x - (rail.ax + dx * t), z - (rail.az + dz * t));
}

/* ----------------------------------------------------------- spatial index */

/** A uniform grid of buckets over plan-view items (rails, obstacles) for range queries. */
export type SpatialIndex<T> = {
  cell: number;
  buckets: Map<string, T[]>;
};

export function createSpatialIndex<T>(
  items: readonly T[],
  bounds: (item: T) => { x0: number; z0: number; x1: number; z1: number },
  cell = 4
): SpatialIndex<T> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const b = bounds(item);
    for (let i = Math.floor(b.x0 / cell); i <= Math.floor(b.x1 / cell); i++)
      for (let j = Math.floor(b.z0 / cell); j <= Math.floor(b.z1 / cell); j++) {
        const k = `${i},${j}`;
        let list = buckets.get(k);
        if (!list) buckets.set(k, (list = []));
        list.push(item);
      }
  }
  return { cell, buckets };
}

/** Items whose buckets touch the square of half-size `r` around (x, z) (deduplicated). */
export function queryIndex<T>(
  index: SpatialIndex<T>,
  x: number,
  z: number,
  r: number
): T[] {
  const c = index.cell;
  const out: T[] = [];
  const seen = new Set<T>();
  for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
    for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
      for (const item of index.buckets.get(`${i},${j}`) ?? []) {
        if (seen.has(item)) continue;
        seen.add(item);
        out.push(item);
      }
    }
  return out;
}

export function railBounds(r: Rail): {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
} {
  return {
    x0: Math.min(r.ax, r.bx),
    z0: Math.min(r.az, r.bz),
    x1: Math.max(r.ax, r.bx),
    z1: Math.max(r.az, r.bz),
  };
}
