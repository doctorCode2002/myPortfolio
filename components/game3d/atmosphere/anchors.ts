/**
 * World positions the atmosphere effects gather around: crystal lamps, the workshop
 * anvil, garden flowers, ponds and grass (fireflies), waterfalls (their sound). Pure.
 */

import { hexKey } from "../logic/hex";
import type { Vec3 } from "../logic/walk-world";
import type { GameWorld } from "../logic/world-layout";

/** Ground positions of an island's objects whose model matches `pattern`. */
export function objectAnchors(
  world: GameWorld,
  islandId: string,
  pattern: RegExp,
  lift = 0
): Vec3[] {
  const island = world.islands.find((i) => i.id === islandId);
  const grid = world.walk.islands.find((g) => g.islandId === islandId);
  if (!island || !grid) return [];
  const out: Vec3[] = [];
  for (const obj of island.objects ?? []) {
    if (!pattern.test(obj.model)) continue;
    const cell = grid.cells.get(hexKey(obj.q, obj.r));
    if (!cell) continue;
    out.push({
      x: cell.x + (obj.offset?.[0] ?? 0),
      y: cell.y + lift,
      z: cell.z + (obj.offset?.[1] ?? 0),
    });
  }
  return out;
}

/** Firefly spots: every pond hex plus a sparse sample of open grass hexes. */
export function fireflyAnchors(world: GameWorld): Vec3[] {
  const out: Vec3[] = [];
  for (const grid of world.walk.islands) {
    let n = 0;
    for (const cell of grid.cells.values()) {
      if (cell.water) {
        out.push({ x: cell.x, y: cell.y, z: cell.z });
        continue;
      }
      if (!cell.ground || cell.blocked || cell.slope) continue;
      if (/sand|dune|road|path|stone/i.test(cell.tile)) continue;
      if (n++ % 5 === 0) out.push({ x: cell.x, y: cell.y, z: cell.z });
    }
  }
  return out;
}

/** Waterfall heads (audio sources): just below each waterfall's hex. */
export function waterfallAnchors(world: GameWorld): Vec3[] {
  const out: Vec3[] = [];
  for (const island of world.islands) {
    const grid = world.walk.islands.find((g) => g.islandId === island.id);
    if (!grid) continue;
    for (const wf of island.underside?.waterfalls ?? []) {
      const cell = grid.cells.get(hexKey(wf.q, wf.r));
      if (cell) out.push({ x: cell.x, y: cell.y - 1.5, z: cell.z });
    }
  }
  return out;
}

/**
 * Write the `k` anchors nearest to (x, z) into `out` (reused), nearest first; returns how
 * many were written. Allocation-free.
 */
export function nearestAnchors(
  anchors: readonly Vec3[],
  x: number,
  z: number,
  k: number,
  out: Vec3[],
  dist: number[]
): number {
  let n = 0;
  for (const a of anchors) {
    const d = (a.x - x) * (a.x - x) + (a.z - z) * (a.z - z);
    if (n < k) {
      out[n] = a;
      dist[n] = d;
      n++;
    } else if (d < (dist[k - 1] ?? Infinity)) {
      out[k - 1] = a;
      dist[k - 1] = d;
    } else continue;
    // Insertion step: keep the list sorted.
    for (let i = n - 1; i > 0 && (dist[i] ?? 0) < (dist[i - 1] ?? 0); i--) {
      const td = dist[i] as number;
      dist[i] = dist[i - 1] as number;
      dist[i - 1] = td;
      const ta = out[i] as Vec3;
      out[i] = out[i - 1] as Vec3;
      out[i - 1] = ta;
    }
  }
  return n;
}
