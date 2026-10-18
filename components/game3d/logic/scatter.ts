/**
 * Deterministic ground decoration (grass tufts, tiny flowers, pebbles) on open grass
 * hexes, seeded by island id and (q, r) so it never changes between loads. Pure.
 */

import { hexKey } from "./hex";
import { createRng, seedFromString } from "./noise";
import type { Island3D } from "./types";
import type { WalkCell } from "./walk-grid";

export type ScatterItem = {
  model: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
};

export type ScatterOptions = {
  /** Candidate model names with relative weights. */
  models: readonly { name: string; weight: number }[];
  /** Hex circumradius. */
  size: number;
  maxPerHex?: number;
  /** Hard cap per island (performance). */
  maxTotal?: number;
  /** Probability that a hex gets at least one item. */
  density?: number;
  /** Rejects item positions that must stay clear (e.g. road ribbons). */
  isClear?: (x: number, z: number) => boolean;
};

/** Hexes that must stay clear: objects, doors, anchors and spawns, plus their own hex only. */
export function reservedHexes(island: Island3D): Set<string> {
  const keys = new Set<string>();
  for (const o of island.objects ?? []) keys.add(hexKey(o.q, o.r));
  for (const d of island.doors ?? []) keys.add(hexKey(d.q, d.r));
  for (const a of island.anchors ?? []) keys.add(hexKey(a.q, a.r));
  const s = island.spawns;
  if (s?.player) keys.add(hexKey(s.player.q, s.player.r));
  if (s?.mayor) keys.add(hexKey(s.mayor.q, s.mayor.r));
  return keys;
}

export function scatterDecor(
  island: Island3D,
  cells: readonly WalkCell[],
  opts: ScatterOptions
): ScatterItem[] {
  const total = opts.models.reduce((s, m) => s + m.weight, 0);
  if (total <= 0 || opts.models.length === 0) return [];
  const reserved = reservedHexes(island);
  const maxPerHex = opts.maxPerHex ?? 2;
  const maxTotal = opts.maxTotal ?? 220;
  const density = opts.density ?? 0.55;
  const out: ScatterItem[] = [];
  const pick = (r: number): string => {
    let acc = 0;
    for (const m of opts.models) {
      acc += m.weight / total;
      if (r <= acc) return m.name;
    }
    return (opts.models[opts.models.length - 1] as { name: string }).name;
  };
  for (const cell of cells) {
    if (out.length >= maxTotal) break;
    if (reserved.has(hexKey(cell.q, cell.r))) continue;
    const rng = createRng(seedFromString(`${island.id}:${cell.q},${cell.r}`));
    if (rng() > density) continue;
    const n = 1 + Math.floor(rng() * maxPerHex);
    for (let i = 0; i < n && out.length < maxTotal; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * opts.size * 0.62;
      const item = {
        model: pick(rng()),
        x: cell.x + Math.cos(a) * d,
        y: cell.y,
        z: cell.z + Math.sin(a) * d,
        rotY: rng() * Math.PI * 2,
        scale: 0.65 + rng() * 0.4,
      };
      if (opts.isClear && !opts.isClear(item.x, item.z)) continue;
      out.push(item);
    }
  }
  return out;
}
