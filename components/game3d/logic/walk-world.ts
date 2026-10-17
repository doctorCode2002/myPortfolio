/**
 * The whole walkable world: every island's walk grid plus the bridge corridors that join
 * them, with a single height query (`surfaceAt`). Pure: no three or react imports.
 */

import { hexKey } from "./hex";
import type { Island3D } from "./types";
import {
  buildIslandWalkGrid,
  cellAtWorld,
  edgeCells,
  isCellWalkable,
  obstacleReach,
  type Obstacle,
  type IslandWalkGrid,
  type WalkCell,
  type WalkGridOptions,
  cellHeightAt,
} from "./walk-grid";

export type Vec3 = { x: number; y: number; z: number };

export type BridgeStyle = "rope" | "stone";

export type BridgeLink = {
  from: string;
  to: string;
  style?: BridgeStyle | undefined;
};

export type BridgeCorridor = {
  id: string;
  from: string;
  to: string;
  style: BridgeStyle;
  /** Anchor hex centres (deck tops) at both ends. */
  a: Vec3;
  b: Vec3;
  fromCell: { q: number; r: number };
  toCell: { q: number; r: number };
  /** Half the walkable width, in metres. */
  halfWidth: number;
  /** Vertical arch (+) or sag (-) at mid-span, in metres. */
  arch: number;
  length: number;
};

export type WalkWorld = {
  islands: IslandWalkGrid[];
  bridges: BridgeCorridor[];
  /** The largest height difference a step may climb (one level plus slack). */
  maxStep: number;
  hexWidth: number;
};

export type Surface = {
  y: number;
  islandId: string | null;
  bridgeId: string | null;
  cell: WalkCell | null;
  /** Position along the bridge (0 at `from`, 1 at `to`). */
  t: number;
};

export type WalkWorldOptions = WalkGridOptions & {
  /** Islands' mayors (or other NPCs) as obstacles: islandId -> hex. */
  npcs?: {
    islandId: string;
    q: number;
    r: number;
    radius?: number;
    id: string;
  }[];
  bridgeWidth?: number;
};

/** Height of the deck at parameter t along a bridge. */
export function bridgeHeightAt(
  bridge: Pick<BridgeCorridor, "a" | "b" | "arch">,
  t: number
): number {
  const c = Math.min(1, Math.max(0, t));
  return (
    bridge.a.y +
    (bridge.b.y - bridge.a.y) * c +
    bridge.arch * Math.sin(Math.PI * c)
  );
}

/** Pick the anchor hex on `island` for a bridge towards `otherId`. */
export function pickAnchor(
  island: Island3D,
  grid: IslandWalkGrid,
  otherId: string,
  toward: { x: number; z: number }
): WalkCell | undefined {
  const named = island.anchors?.find((a) => a.id === `to_${otherId}`);
  if (named) {
    const cell = grid.cells.get(hexKey(named.q, named.r));
    if (cell) return cell;
  }
  // Fallback: the walkable edge hex closest to the other island.
  let best: WalkCell | undefined;
  let bestD = Infinity;
  for (const cell of edgeCells(grid)) {
    if (!isCellWalkable(cell)) continue;
    const d = Math.hypot(cell.x - toward.x, cell.z - toward.z);
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

export function buildWalkWorld(
  islands: readonly Island3D[],
  links: readonly BridgeLink[],
  opts: WalkWorldOptions = {}
): WalkWorld {
  const grids = islands.map((island) =>
    buildIslandWalkGrid(island, {
      ...opts,
      extraObstacles: (opts.npcs ?? [])
        .filter((n) => n.islandId === island.id)
        .map((n) => ({
          q: n.q,
          r: n.r,
          radius: n.radius ?? 0.35,
          source: n.id,
        })),
    })
  );
  const hexWidth =
    grids[0]?.hexWidth ?? opts.hexWidth ?? opts.manifest?.hexSize ?? 2;
  const levelHeight = grids[0]?.levelHeight ?? 0.5;
  const halfWidth = (opts.bridgeWidth ?? hexWidth * 1.0) / 2 - 0.05;

  const bridges: BridgeCorridor[] = [];
  for (const link of links) {
    const ia = islands.findIndex((i) => i.id === link.from);
    const ib = islands.findIndex((i) => i.id === link.to);
    const islandA = islands[ia];
    const islandB = islands[ib];
    const gridA = grids[ia];
    const gridB = grids[ib];
    if (!islandA || !islandB || !gridA || !gridB) continue;
    const anchorA = pickAnchor(islandA, gridA, islandB.id, gridB.origin);
    const anchorB = pickAnchor(islandB, gridB, islandA.id, gridA.origin);
    if (!anchorA || !anchorB) continue;
    const a = { x: anchorA.x, y: anchorA.y, z: anchorA.z };
    const b = { x: anchorB.x, y: anchorB.y, z: anchorB.z };
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const style: BridgeStyle = link.style ?? "rope";
    const span = Math.max(0, length - hexWidth);
    const arch =
      style === "stone"
        ? Math.min(0.6, span * 0.03)
        : -Math.min(0.5, span * 0.025);
    bridges.push({
      id: `${link.from}-${link.to}`,
      from: link.from,
      to: link.to,
      style,
      a,
      b,
      fromCell: { q: anchorA.q, r: anchorA.r },
      toCell: { q: anchorB.q, r: anchorB.r },
      halfWidth,
      arch,
      length,
    });
  }

  return { islands: grids, bridges, maxStep: levelHeight * 1.25, hexWidth };
}

/** Project a point onto a bridge's centre line. */
export function projectOnBridge(
  bridge: BridgeCorridor,
  x: number,
  z: number
): { t: number; dist: number } {
  const dx = bridge.b.x - bridge.a.x;
  const dz = bridge.b.z - bridge.a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = ((x - bridge.a.x) * dx + (z - bridge.a.z) * dz) / len2;
  const px = bridge.a.x + dx * t;
  const pz = bridge.a.z + dz * t;
  return { t, dist: Math.hypot(x - px, z - pz) };
}

/**
 * The walkable surface under a world point, or null for void, water, cliffs and
 * building footprints. Island tiles win over bridge corridors where they overlap.
 */
export function surfaceAt(
  world: WalkWorld,
  x: number,
  z: number,
  nearY?: number
): Surface | null {
  let blockedByIsland = false;
  for (const grid of world.islands) {
    const cell = cellAtWorld(grid, x, z);
    if (!cell) continue;
    if (isCellWalkable(cell)) {
      return {
        y: cellHeightAt(cell, x, z, grid.hexWidth),
        islandId: grid.islandId,
        bridgeId: null,
        cell,
        t: 0,
      };
    }
    blockedByIsland = true;
  }
  // Water, cliffs and building footprints stay blocked even under a bridge corridor.
  if (blockedByIsland) return null;
  let best: Surface | null = null;
  for (const bridge of world.bridges) {
    const { t, dist } = projectOnBridge(bridge, x, z);
    if (t < 0 || t > 1 || dist > bridge.halfWidth) continue;
    const y = bridgeHeightAt(bridge, t);
    if (
      !best ||
      (nearY !== undefined && Math.abs(y - nearY) < Math.abs(best.y - nearY))
    ) {
      best = { y, islandId: null, bridgeId: bridge.id, cell: null, t };
    }
  }
  return best;
}

/** All obstacles near a point (cheap pre-filter by island bounds is unnecessary at this size). */
export function obstaclesNear(
  world: WalkWorld,
  x: number,
  z: number,
  range: number
): Obstacle[] {
  const out: Obstacle[] = [];
  for (const grid of world.islands) {
    for (const o of grid.obstacles) {
      const reach = obstacleReach(o) + range;
      if (Math.abs(o.x - x) <= reach && Math.abs(o.z - z) <= reach) out.push(o);
    }
  }
  return out;
}

export function islandGrid(
  world: WalkWorld,
  id: string
): IslandWalkGrid | undefined {
  return world.islands.find((g) => g.islandId === id);
}
