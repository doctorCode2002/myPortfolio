/**
 * Per-island walk grid: which hexes can be walked on, at which height, and which circle
 * obstacles (trees, rocks, props, NPCs) stand on them. Pure: no three or react imports.
 */

import { groundJitter } from "./ground";
import {
  objectCollision,
  isTileWalkable,
  isWaterTile,
  type ModelLocalBounds,
  type ObjectCollision,
} from "./catalog";
import {
  DEFAULT_HEX_WIDTH,
  circumradiusFromWidth,
  hexKey,
  hexToWorld,
  worldToHex,
  type Point2,
} from "./hex";
import type { Island3D, IslandObject, Manifest } from "./types";

export const DEFAULT_LEVEL_HEIGHT = 0.5;

/**
 * Height added to a dry tile's top by the optional heightJitter (never below the tile
 * top, so the tile's bevels stay hidden under the grass skin).
 */
export function groundLift(x: number, z: number, amplitude: number): number {
  return amplitude ? amplitude + groundJitter(x, z, amplitude) : 0;
}

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
  /**
   * Sloped tiles: the surface rises by `rise` from the low edge (y = `lowY`) towards the
   * high side (world direction dirX, dirZ). `y` holds the height at the centre.
   */
  slope?: { rise: number; dirX: number; dirZ: number; lowY: number };
  /** A bridge model's deck covers this hex (walkable even over a river). */
  deck?: boolean;
};

/** Height profile across a slope tile (fitted to the KayKit ramps): t = 0 low edge, 1 high edge. */
export function slopeProfile(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 1.6);
}

/** Surface height of a cell at a world point (slopes vary across the hex, others are flat). */
export function cellHeightAt(
  cell: WalkCell,
  x: number,
  z: number,
  hexWidth: number
): number {
  const sl = cell.slope;
  if (!sl) return cell.y;
  const along = (x - cell.x) * sl.dirX + (z - cell.z) * sl.dirZ;
  return sl.lowY + sl.rise * slopeProfile((along / (hexWidth / 2) + 1) / 2);
}

/** Rise of a slope tile from the manifest (`rise`) or its name; 0 for flat tiles. */
export function tileRise(tile: string, manifest: Manifest | null): number {
  const m = manifest?.models[tile] as
    (Manifest["models"][string] & { rise?: number }) | undefined;
  if (typeof m?.rise === "number") return m.rise;
  if (/sloped-high/i.test(tile)) return 1;
  if (/sloped|ramp/i.test(tile)) return 0.5;
  return 0;
}

export type CircleObstacle = {
  shape: "circle";
  x: number;
  z: number;
  radius: number;
  source: string;
  /** Island object key (`<islandId>:<object index>`), see `objectKey`. */
  key?: string;
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
  /** Island object key (`<islandId>:<object index>`), see `objectKey`. */
  key?: string;
};

/** Stable key of an island object: the island id and its index in `objects`. */
export function objectKey(islandId: string, index: number): string {
  return `${islandId}:${index}`;
}

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
  /** Model-space bounds for models whose geometry sits off their origin (hex-edge fences). */
  bounds?: Readonly<Record<string, ModelLocalBounds | null | undefined>>;
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

/**
 * The plan-view obstacle of an object's collision at its world position (x, z): a circle,
 * or a box turned by the object's rotation around its local bounds centre.
 */
export function collisionObstacle(
  col: ObjectCollision,
  obj: Pick<IslandObject, "model" | "rot">,
  x: number,
  z: number,
  key: string
): Obstacle | null {
  if (col.type === "circle")
    return col.radius > 0
      ? { shape: "circle", x, z, radius: col.radius, source: obj.model, key }
      : null;
  if (col.type !== "box") return null;
  const rot = ((obj.rot ?? 0) * Math.PI) / 180;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return {
    shape: "box",
    x: x + c * col.cx + s * col.cz,
    z: z - s * col.cx + c * col.cz,
    hx: col.hx,
    hz: col.hz,
    rot,
    source: obj.model,
    key,
  };
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
    const rise = tileRise(hex.tile, manifest);
    const flatY = baseY + level * levelHeight;
    // A slope's high side points along the tile's local +x, turned by its rotation.
    const rot = ((hex.rot ?? 0) * Math.PI) / 180;
    const slope =
      rise > 0
        ? { rise, dirX: Math.cos(rot), dirZ: -Math.sin(rot), lowY: flatY }
        : undefined;
    cells.set(hexKey(hex.q, hex.r), {
      ...(slope ? { slope } : {}),
      q: hex.q,
      r: hex.r,
      level,
      y: slope
        ? flatY + rise * slopeProfile(0.5)
        : flatY + (water ? 0 : groundLift(p.x, p.z, island.heightJitter ?? 0)),
      x: p.x,
      z: p.z,
      tile: hex.tile,
      water,
      ground: hex.walkable ?? isTileWalkable(hex.tile, manifest),
      blocked: false,
    });
  }

  const obstacles: Obstacle[] = [];
  for (const [index, obj] of (island.objects ?? []).entries()) {
    const key = objectKey(island.id, index);
    const col = objectCollision(
      obj,
      manifest,
      hexWidth,
      opts.bounds?.[obj.model] ?? null
    );
    if (col.type === "none") continue;
    const p = islandHexToWorld(island, obj.q, obj.r, size);
    const x = p.x + (obj.offset?.[0] ?? 0);
    const z = p.z + (obj.offset?.[1] ?? 0);
    if (col.type === "deck") {
      // The deck makes its whole hex walkable at the deck top (bridges are placed at
      // varying angles to their roads, so no rails that could cut the crossing).
      const cell = cells.get(hexKey(obj.q, obj.r));
      if (cell) {
        cell.ground = true;
        cell.deck = true;
        cell.y = baseY + cell.level * levelHeight + col.top;
        delete cell.slope;
      }
      continue;
    }
    if (col.type === "box" && col.blockHex) {
      const cell = cells.get(hexKey(obj.q, obj.r));
      if (cell) cell.blocked = true;
    }
    const o = collisionObstacle(col, obj, x, z, key);
    if (o) obstacles.push(o);
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
