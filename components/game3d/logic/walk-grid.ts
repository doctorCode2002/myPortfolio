/**
 * Per-island walk grid: which hexes can be walked on, at which height, and which circle
 * obstacles (trees, rocks, props, NPCs) stand on them. Pure: no three or react imports.
 */

import { objectCollision, isTileWalkable, isWaterTile } from "./catalog";
import {
  DEFAULT_HEX_WIDTH,
  circumradiusFromWidth,
  hexKey,
  hexToWorld,
  worldToHex,
  type Point2,
} from "./hex";
import type { Island3D, Manifest } from "./types";

export const DEFAULT_LEVEL_HEIGHT = 0.5;

export type WalkCell = {
  q: number;
  r: number;
  /** Stacked height level of the tile. */
  level: number;
  /** World y of the tile's top surface. */
  y: number;
  /** World centre of the hex. */
  x: number;
  z: number;
  tile: string;
  water: boolean;
  /** Terrain allows walking (before objects). */
  ground: boolean;
  /** A building footprint covers the hex. */
  blocked: boolean;
};

export type CircleObstacle = {
  shape: "circle";
  x: number;
  z: number;
  radius: number;
  source: string;
};

/** An oriented box: half extents along its local axes, rotated by `rot` radians around +y. */
export type BoxObstacle = {
  shape: "box";
  x: number;
  z: number;
  hx: number;
  hz: number;
  rot: number;
  source: string;
};

export type Obstacle = CircleObstacle | BoxObstacle;

/** Signed distance from a point to an obstacle's outline (negative inside). */
export function obstacleDistance(o: Obstacle, x: number, z: number): number {
  const dx = x - o.x;
  const dz = z - o.z;
  if (o.shape === "circle") return Math.hypot(dx, dz) - o.radius;
  const c = Math.cos(o.rot);
  const s = Math.sin(o.rot);
  const lx = Math.abs(c * dx - s * dz) - o.hx;
  const lz = Math.abs(s * dx + c * dz) - o.hz;
  const outside = Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
  return outside + Math.min(Math.max(lx, lz), 0);
}

/** Bounding radius of an obstacle (for cheap range checks). */
export function obstacleReach(o: Obstacle): number {
  return o.shape === "circle" ? o.radius : Math.hypot(o.hx, o.hz);
}

export type IslandWalkGrid = {
  islandId: string;
  /** Hex circumradius in metres. */
  size: number;
  hexWidth: number;
  levelHeight: number;
  origin: Point2;
  baseY: number;
  cells: Map<string, WalkCell>;
  obstacles: Obstacle[];
};

export type WalkGridOptions = {
  manifest?: Manifest | null;
  /** Tile width across flats in metres (defaults to the manifest's hexSize, then 2). */
  hexWidth?: number;
  levelHeight?: number;
  /** Extra obstacles in island-local hex terms, e.g. the mayor. */
  extraObstacles?: { q: number; r: number; radius: number; source: string }[];
};

export function resolveHexWidth(opts: WalkGridOptions = {}): number {
  return opts.hexWidth ?? opts.manifest?.hexSize ?? DEFAULT_HEX_WIDTH;
}

export function resolveLevelHeight(opts: WalkGridOptions = {}): number {
  return opts.levelHeight ?? opts.manifest?.levelHeight ?? DEFAULT_LEVEL_HEIGHT;
}

/** World position (x, z) of a hex centre on an island. */
export function islandHexToWorld(
  island: Pick<Island3D, "center">,
  q: number,
  r: number,
  size: number
): Point2 {
  const p = hexToWorld(q, r, size);
  return { x: island.center[0] + p.x, z: island.center[1] + p.z };
}

export function buildIslandWalkGrid(
  island: Island3D,
  opts: WalkGridOptions = {}
): IslandWalkGrid {
  const manifest = opts.manifest ?? null;
  const hexWidth = resolveHexWidth(opts);
  const levelHeight = resolveLevelHeight(opts);
  const size = circumradiusFromWidth(hexWidth);
  const baseY = island.baseY ?? 0;
  const cells = new Map<string, WalkCell>();

  for (const hex of island.hexes) {
    const level = hex.h ?? 0;
    const p = islandHexToWorld(island, hex.q, hex.r, size);
    const water = isWaterTile(hex.tile, manifest);
    cells.set(hexKey(hex.q, hex.r), {
      q: hex.q,
      r: hex.r,
      level,
      y: baseY + level * levelHeight,
      x: p.x,
      z: p.z,
      tile: hex.tile,
      water,
      ground: hex.walkable ?? isTileWalkable(hex.tile, manifest),
      blocked: false,
    });
  }

  const obstacles: Obstacle[] = [];
  for (const obj of island.objects ?? []) {
    const col = objectCollision(obj, manifest, hexWidth);
    if (col.type === "none") continue;
    const p = islandHexToWorld(island, obj.q, obj.r, size);
    const x = p.x + (obj.offset?.[0] ?? 0);
    const z = p.z + (obj.offset?.[1] ?? 0);
    if (col.type === "circle") {
      if (col.radius > 0)
        obstacles.push({
          shape: "circle",
          x,
          z,
          radius: col.radius,
          source: obj.model,
        });
      continue;
    }
    if (col.blockHex) {
      const cell = cells.get(hexKey(obj.q, obj.r));
      if (cell) cell.blocked = true;
    }
    obstacles.push({
      shape: "box",
      x,
      z,
      hx: col.hx,
      hz: col.hz,
      rot: ((obj.rot ?? 0) * Math.PI) / 180,
      source: obj.model,
    });
  }
  for (const extra of opts.extraObstacles ?? []) {
    const p = islandHexToWorld(island, extra.q, extra.r, size);
    obstacles.push({
      shape: "circle",
      x: p.x,
      z: p.z,
      radius: extra.radius,
      source: extra.source,
    });
  }

  return {
    islandId: island.id,
    size,
    hexWidth,
    levelHeight,
    origin: { x: island.center[0], z: island.center[1] },
    baseY,
    cells,
    obstacles,
  };
}

/** A hex's terrain is walkable and no building covers it. */
export function isCellWalkable(cell: WalkCell | undefined): cell is WalkCell {
  return Boolean(cell && cell.ground && !cell.blocked);
}

/** The cell under a world point, if the island has a tile there. */
export function cellAtWorld(
  grid: IslandWalkGrid,
  x: number,
  z: number
): WalkCell | undefined {
  const h = worldToHex(x - grid.origin.x, z - grid.origin.z, grid.size);
  return grid.cells.get(hexKey(h.q, h.r));
}

/** Island-local axial coordinates of a world point. */
export function worldToIslandHex(
  grid: IslandWalkGrid,
  x: number,
  z: number
): { q: number; r: number } {
  return worldToHex(x - grid.origin.x, z - grid.origin.z, grid.size);
}

/** Cells on the island's outer edge (fewer than six tile neighbours). */
export function edgeCells(grid: IslandWalkGrid): WalkCell[] {
  const out: WalkCell[] = [];
  for (const cell of grid.cells.values()) {
    let n = 0;
    for (const [dq, dr] of [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ] as const) {
      if (grid.cells.has(hexKey(cell.q + dq, cell.r + dr))) n++;
    }
    if (n < 6) out.push(cell);
  }
  return out;
}
