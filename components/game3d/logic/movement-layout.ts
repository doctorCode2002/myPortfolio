/**
 * Movement features in world space, built from the islands' `movement` blocks: glider
 * launch platforms, lookout towers (their decks become small raised standable patches of
 * the walk world, and their hexes become blocked, so walkers never reach them on foot),
 * jump pads with precomputed landing spots and arcs, and the thermals (rising air over the
 * waterfalls and the island centres). Also the solid-height query the arcs and the glider
 * collide with. Pure: no three or react imports.
 */

import { planArc, type JumpArc, type Point3 } from "./jump-arc";
import { hexKey } from "./hex";
import type { Island3D, Manifest } from "./types";
import {
  cellAtWorld,
  cellHeightAt,
  islandHexToWorld,
  isCellWalkable,
  objectKey,
  obstacleDistance,
} from "./walk-grid";
import { obstaclesNear, type WalkWorld } from "./walk-world";
import { buildZiplines, ZIP_RANGE, type Zipline } from "./zipline";

export type LaunchSpot = {
  id: string;
  islandId: string;
  x: number;
  y: number;
  z: number;
  heading: number;
};

export type Lookout = {
  id: string;
  islandId: string;
  q: number;
  r: number;
  x: number;
  z: number;
  /** Ground height of the hex, and the deck top. */
  groundY: number;
  y: number;
  /** Standable deck radius (the drawn deck is a little wider). */
  radius: number;
};

export type JumpPad = {
  id: string;
  islandId: string;
  /** "pad" on the ground, "return" on a lookout deck (hops back down). */
  kind: "pad" | "return";
  x: number;
  y: number;
  z: number;
  /** Interaction range (metres). */
  range: number;
  /** Precomputed landing spot and flight. */
  target: Point3;
  arc: JumpArc;
  /** Sampled clearance of the arc over the solids (positive = clear). */
  clearance: number;
};

export type Thermal = {
  x: number;
  z: number;
  radius: number;
  /** Lift at the core (m/s). */
  strength: number;
  /** Lift fades to nothing over the last few metres below this height. */
  ceiling: number;
  kind: "falls" | "centre";
};

export type MovementLayout = {
  launches: LaunchSpot[];
  lookouts: Lookout[];
  pads: JumpPad[];
  ziplines: Zipline[];
  thermals: Thermal[];
  /** Top of the building on each blocked hex (`<islandId>/<q,r>`). */
  blockTops: Map<string, number>;
  /** Height of each solid prop (by object key) above its ground. */
  propHeights: Map<string, number>;
  /** Below this a glider is gone (respawn). */
  killY: number;
  /** Plan-view bounds of the world (a glider beyond them respawns). */
  centre: { x: number; z: number };
  radius: number;
};

export const LOOKOUT_HEIGHT = 3;
/** Standable radius of a lookout deck (a hex is 1 m from centre to flat). */
export const LOOKOUT_RADIUS = 0.85;
export const PAD_RANGE = 0.95;
export const LAUNCH_RANGE = 1.3;

function modelHeight(
  manifest: Manifest | null,
  model: string,
  scale = 1
): number {
  const m = manifest?.models[model];
  return (m?.size?.[1] ?? 2.5) * scale;
}

/**
 * Highest solid surface at a plan-view point: island terrain columns (water at its
 * surface), buildings on blocked hexes, lookout towers, and (with `props`) the colliders of
 * solid props at their heights. -Infinity over the void.
 */
export function solidTopAt(
  walk: WalkWorld,
  layout: Pick<MovementLayout, "blockTops" | "propHeights">,
  x: number,
  z: number,
  props = false
): number {
  let top = -Infinity;
  for (const grid of walk.islands) {
    const cell = cellAtWorld(grid, x, z);
    if (!cell) continue;
    let t = cell.water ? cell.y : cellHeightAt(cell, x, z, grid.hexWidth);
    if (cell.blocked) {
      const b = layout.blockTops.get(
        `${grid.islandId}/${hexKey(cell.q, cell.r)}`
      );
      if (b !== undefined) t = Math.max(t, b);
    }
    top = Math.max(top, t);
    if (props) {
      for (const o of obstaclesNear(walk, x, z, 0)) {
        if (o.key === undefined || obstacleDistance(o, x, z) > 0) continue;
        const h = layout.propHeights.get(o.key);
        if (h !== undefined) top = Math.max(top, cell.y + h);
      }
    }
  }
  return top;
}

function islandTop(walk: WalkWorld, islandId: string): number {
  const grid = walk.islands.find((g) => g.islandId === islandId);
  let top = -Infinity;
  for (const c of grid?.cells.values() ?? [])
    if (isCellWalkable(c)) top = Math.max(top, c.y);
  return Number.isFinite(top) ? top : 0;
}

/**
 * Build the layout and plug the lookouts into the walk world (their hexes blocked, their
 * decks as roof patches). Call before the nav graph is built.
 */
export function buildMovementLayout(
  islands: readonly Island3D[],
  walk: WalkWorld,
  manifest: Manifest | null
): MovementLayout {
  const blockTops = new Map<string, number>();
  const propHeights = new Map<string, number>();
  const launches: LaunchSpot[] = [];
  const lookouts: Lookout[] = [];
  const thermals: Thermal[] = [];
  let killY = Infinity;
  let cx = 0;
  let cz = 0;
  const extents: { x: number; z: number; r: number }[] = [];

  for (const island of islands) {
    const grid = walk.islands.find((g) => g.islandId === island.id);
    if (!grid) continue;
    (island.objects ?? []).forEach((obj, index) => {
      const h = modelHeight(manifest, obj.model, obj.scale ?? 1);
      propHeights.set(objectKey(island.id, index), h);
      const cell = grid.cells.get(hexKey(obj.q, obj.r));
      if (cell?.blocked) {
        const k = `${island.id}/${hexKey(obj.q, obj.r)}`;
        blockTops.set(k, Math.max(blockTops.get(k) ?? -Infinity, cell.y + h));
      }
    });
    let minY = Infinity;
    let radius = 0;
    for (const c of grid.cells.values()) {
      minY = Math.min(minY, c.y);
      radius = Math.max(
        radius,
        Math.hypot(c.x - grid.origin.x, c.z - grid.origin.z) + grid.size
      );
    }
    killY = Math.min(killY, minY - 4);
    extents.push({ x: grid.origin.x, z: grid.origin.z, r: radius });
    cx += grid.origin.x;
    cz += grid.origin.z;
    const top = islandTop(walk, island.id);

    // Thermals: a broad, gentle one over the island, strong narrow ones off the falls.
    thermals.push({
      x: grid.origin.x,
      z: grid.origin.z,
      radius: Math.max(4.5, radius * 0.5),
      strength: 2,
      ceiling: top + 8,
      kind: "centre",
    });
    for (const f of island.underside?.waterfalls ?? []) {
      const p = islandHexToWorld(island, f.q, f.r, grid.size);
      const dx = p.x - grid.origin.x;
      const dz = p.z - grid.origin.z;
      const d = Math.hypot(dx, dz) || 1;
      thermals.push({
        x: p.x + (dx / d) * grid.size * 1.4,
        z: p.z + (dz / d) * grid.size * 1.4,
        radius: 3.2,
        strength: 3.6,
        ceiling: top + 10,
        kind: "falls",
      });
    }

    const mv = island.movement;
    for (const l of mv?.launches ?? []) {
      const cell = grid.cells.get(hexKey(l.q, l.r));
      if (!cell) continue;
      const x = cell.x + (l.offset?.[0] ?? 0);
      const z = cell.z + (l.offset?.[1] ?? 0);
      launches.push({
        id: l.id,
        islandId: island.id,
        x,
        y: cellHeightAt(cell, x, z, grid.hexWidth),
        z,
        heading:
          l.rot !== undefined
            ? (l.rot * Math.PI) / 180
            : Math.atan2(x - grid.origin.x, z - grid.origin.z),
      });
    }
    for (const l of mv?.lookouts ?? []) {
      const cell = grid.cells.get(hexKey(l.q, l.r));
      if (!cell) continue;
      const y = cell.y + (l.height ?? LOOKOUT_HEIGHT);
      cell.blocked = true;
      blockTops.set(`${island.id}/${hexKey(l.q, l.r)}`, y);
      lookouts.push({
        id: l.id,
        islandId: island.id,
        q: l.q,
        r: l.r,
        x: cell.x,
        z: cell.z,
        groundY: cell.y,
        y,
        radius: LOOKOUT_RADIUS,
      });
    }
  }
  const n = extents.length || 1;
  const centre = { x: cx / n, z: cz / n };
  let worldRadius = 0;
  for (const e of extents)
    worldRadius = Math.max(
      worldRadius,
      Math.hypot(e.x - centre.x, e.z - centre.z) + e.r
    );

  walk.roofs = [
    ...(walk.roofs ?? []).filter((r) => !lookouts.some((l) => l.id === r.id)),
    ...lookouts.map((l) => ({
      id: l.id,
      islandId: l.islandId,
      x: l.x,
      z: l.z,
      radius: l.radius,
      y: l.y,
    })),
  ];

  const layout: MovementLayout = {
    launches,
    lookouts,
    pads: [],
    ziplines: buildZiplines(islands, walk),
    thermals,
    blockTops,
    propHeights,
    killY: Number.isFinite(killY) ? killY : -10,
    centre,
    radius: worldRadius + 18,
  };
  const top = (x: number, z: number): number =>
    solidTopAt(walk, layout, x, z, true);

  for (const island of islands) {
    const grid = walk.islands.find((g) => g.islandId === island.id);
    if (!grid) continue;
    const ground = (q: number, r: number): Point3 | null => {
      const c = grid.cells.get(hexKey(q, r));
      return c ? { x: c.x, y: c.y, z: c.z } : null;
    };
    for (const pad of island.movement?.pads ?? []) {
      const from = ground(pad.q, pad.r);
      let to: Point3 | null = null;
      if ("lookout" in pad.to) {
        const id = pad.to.lookout;
        const l = lookouts.find((o) => o.id === id);
        to = l ? { x: l.x, y: l.y, z: l.z } : null;
      } else to = ground(pad.to.q, pad.to.r);
      if (!from || !to) continue;
      const { arc, clearance } = planArc(from, to, top);
      layout.pads.push({
        id: pad.id,
        islandId: island.id,
        kind: "pad",
        ...from,
        range: PAD_RANGE,
        target: to,
        arc,
        clearance,
      });
    }
    for (const l of island.movement?.lookouts ?? []) {
      const look = lookouts.find((o) => o.id === l.id);
      const to = ground(l.down.q, l.down.r);
      if (!look || !to) continue;
      const from = { x: look.x, y: look.y, z: look.z };
      const { arc, clearance } = planArc(from, to, top);
      layout.pads.push({
        id: `${l.id}-down`,
        islandId: island.id,
        kind: "return",
        ...from,
        range: look.radius,
        target: to,
        arc,
        clearance,
      });
    }
  }
  return layout;
}

/** Something a walker can use: a glider launch, a jump pad or a zipline start. */
export type MoveSpot =
  | { kind: "launch"; spot: LaunchSpot }
  | { kind: "pad"; spot: JumpPad }
  | { kind: "zip"; spot: Zipline };

/** The pad, launch or zipline in reach of a walker at (x, y, z), nearest first; or null. */
export function nearestMoveSpot(
  layout: MovementLayout,
  x: number,
  y: number,
  z: number
): MoveSpot | null {
  let best: MoveSpot | null = null;
  let bestD = Infinity;
  const consider = (spot: MoveSpot, range: number, dy: number): void => {
    const s = spot.spot;
    if (Math.abs(s.y - y) > dy) return;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= range && d < bestD) {
      bestD = d;
      best = spot;
    }
  };
  for (const p of layout.pads) consider({ kind: "pad", spot: p }, p.range, 1);
  for (const l of layout.launches)
    consider({ kind: "launch", spot: l }, LAUNCH_RANGE, 1.2);
  for (const zl of layout.ziplines)
    consider({ kind: "zip", spot: zl }, ZIP_RANGE, 1.2);
  return best;
}
