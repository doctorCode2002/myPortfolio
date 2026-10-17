/**
 * Generated low-poly rock underside for a floating island: an inverted noisy cone fitted
 * to the island outline, flat-shaded with 2-3 colour bands, plus hanging roots.
 * Produces plain typed arrays (island-local coordinates); the renderer wraps them in a
 * BufferGeometry. Pure: no three or react imports.
 */

import { createRng, valueNoise2 } from "./noise";
import type { Point2 } from "./hex";

export type UndersideStyle = "rock" | "sand";

export type UndersideOptions = {
  depth?: number;
  seed?: number;
  style?: UndersideStyle;
  /** y of the top rim (just under the tiles' top surface). */
  topY?: number;
  /** Number of angular segments around the outline. */
  segments?: number;
  rings?: number;
};

export type RootSegment = {
  a: [number, number, number];
  b: [number, number, number];
  radius: number;
};

export type UndersideData = {
  /** Non-indexed triangle positions (xyz per vertex). */
  positions: Float32Array;
  /** Per-vertex colours (rgb, linear 0..1), constant per face for flat shading. */
  colors: Float32Array;
  roots: RootSegment[];
  /** Centroid of the outline (local). */
  centroid: Point2;
  /** Outline radius per angle segment (local, from the centroid). */
  profile: number[];
  depth: number;
};

type Rgb = [number, number, number];

const PALETTES: Record<UndersideStyle, Rgb[]> = {
  // soil lip, warm rock, deep cool rock
  rock: [
    [0.36, 0.27, 0.17],
    [0.55, 0.43, 0.33],
    [0.38, 0.34, 0.42],
  ],
  sand: [
    [0.62, 0.49, 0.31],
    [0.78, 0.64, 0.45],
    [0.6, 0.47, 0.38],
  ],
};

/**
 * The island outline as a radial profile: for each angle bin around the centroid, the
 * farthest hex corner. Empty bins (concave notches) are filled from their neighbours,
 * then the profile is lightly smoothed.
 */
export function outlineProfile(
  centres: readonly Point2[],
  size: number,
  segments: number
): { centroid: Point2; profile: number[] } {
  const n = centres.length || 1;
  const centroid = {
    x: centres.reduce((s, c) => s + c.x, 0) / n,
    z: centres.reduce((s, c) => s + c.z, 0) / n,
  };
  const bins = new Array<number>(segments).fill(0);
  const corners: Point2[] = [];
  for (const c of centres) {
    corners.push(c);
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      corners.push({
        x: c.x + size * Math.cos(a),
        z: c.z + size * Math.sin(a),
      });
      // Mid-edge points keep the profile from undercutting flat sides.
      const b = (Math.PI / 180) * (60 * i);
      corners.push({
        x: c.x + size * 0.866 * Math.cos(b),
        z: c.z + size * 0.866 * Math.sin(b),
      });
    }
  }
  for (const p of corners) {
    const dx = p.x - centroid.x;
    const dz = p.z - centroid.z;
    let ang = Math.atan2(dz, dx);
    if (ang < 0) ang += Math.PI * 2;
    const idx = Math.floor((ang / (Math.PI * 2)) * segments) % segments;
    bins[idx] = Math.max(bins[idx] ?? 0, Math.hypot(dx, dz));
  }
  // Fill empty bins by the max of the nearest non-empty neighbours.
  for (let i = 0; i < segments; i++) {
    if ((bins[i] ?? 0) > 0) continue;
    let l = 1;
    while (l < segments && (bins[(i - l + segments) % segments] ?? 0) === 0)
      l++;
    let r = 1;
    while (r < segments && (bins[(i + r) % segments] ?? 0) === 0) r++;
    bins[i] = Math.max(
      bins[(i - l + segments) % segments] ?? size,
      bins[(i + r) % segments] ?? size
    );
  }
  // A light max-preserving smoothing (keeps the rim under every tile).
  const profile = bins.map((v, i) => {
    const a = bins[(i - 1 + segments) % segments] ?? v;
    const b = bins[(i + 1) % segments] ?? v;
    return Math.max(v, (a + b) / 2) * 0.98;
  });
  return { centroid, profile };
}

export function buildUnderside(
  centres: readonly Point2[],
  size: number,
  opts: UndersideOptions = {}
): UndersideData {
  const seed = opts.seed ?? 1;
  const segments = opts.segments ?? 36;
  const rings = opts.rings ?? 6;
  const topY = opts.topY ?? -0.05;
  const style = opts.style ?? "rock";
  const palette = PALETTES[style];
  const rng = createRng(seed);
  const { centroid, profile } = outlineProfile(centres, size, segments);
  const maxR = Math.max(...profile, size);
  const depth = opts.depth ?? Math.max(3, maxR * 0.9);

  // Ring vertices: ring 0 is the top rim; the last ring tapers towards the tip.
  const ringPts: [number, number, number][][] = [];
  for (let k = 0; k <= rings; k++) {
    const t = k / (rings + 1);
    const row: [number, number, number][] = [];
    for (let i = 0; i < segments; i++) {
      const ang = (i / segments) * Math.PI * 2;
      const base = profile[i] ?? size;
      const n = valueNoise2(i * 0.45, k * 0.9, seed) - 0.5;
      // Stay wide under the rim (a visible rock face), then taper to the tip.
      const shrink = k === 0 ? 1 : (1 - Math.pow(t, 1.35)) * (1 + n * 0.3);
      const radius = base * shrink * (k === 1 ? 1.03 : 1.0);
      const y =
        k === 0 ? topY : topY - depth * Math.pow(t, 0.85) + n * depth * 0.08;
      row.push([
        centroid.x + Math.cos(ang) * radius,
        y,
        centroid.z + Math.sin(ang) * radius,
      ]);
    }
    ringPts.push(row);
  }
  const tip: [number, number, number] = [
    centroid.x + (rng() - 0.5) * maxR * 0.2,
    topY - depth * (1 + rng() * 0.15),
    centroid.z + (rng() - 0.5) * maxR * 0.2,
  ];

  const pos: number[] = [];
  const col: number[] = [];
  const pushTri = (a: number[], b: number[], c: number[], t: number): void => {
    pos.push(...a, ...b, ...c);
    const band = t < 0.14 ? 0 : t < 0.55 ? 1 : 2;
    const baseCol = palette[band] as Rgb;
    const jitter = 0.9 + rng() * 0.2;
    for (let v = 0; v < 3; v++)
      col.push(baseCol[0] * jitter, baseCol[1] * jitter, baseCol[2] * jitter);
  };

  // Top cap (a fan) so gaps between tiles never show the sky.
  const capC = [centroid.x, topY, centroid.z];
  const top = ringPts[0] as [number, number, number][];
  for (let i = 0; i < segments; i++) {
    const a = top[i] as number[];
    const b = top[(i + 1) % segments] as number[];
    pos.push(...capC, ...b, ...a);
    for (let v = 0; v < 3; v++) col.push(...(palette[0] as Rgb));
  }
  // Side bands (outward-facing, counter-clockwise seen from outside).
  for (let k = 0; k < rings; k++) {
    const up = ringPts[k] as [number, number, number][];
    const dn = ringPts[k + 1] as [number, number, number][];
    const t = (k + 0.5) / (rings + 1);
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      pushTri(up[i] as number[], up[j] as number[], dn[i] as number[], t);
      pushTri(up[j] as number[], dn[j] as number[], dn[i] as number[], t);
    }
  }
  const last = ringPts[rings] as [number, number, number][];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    pushTri(last[i] as number[], last[j] as number[], tip, 0.95);
  }

  // Hanging roots from just under the rim.
  const roots: RootSegment[] = [];
  const ring1 = ringPts[1] as [number, number, number][];
  const rootCount = Math.max(3, Math.round(segments / 4));
  for (let n = 0; n < rootCount; n++) {
    const i = Math.floor(rng() * segments);
    const p = ring1[i] as [number, number, number];
    const q = top[i] as [number, number, number];
    let cur: [number, number, number] = [
      (p[0] + q[0]) / 2,
      (p[1] + q[1]) / 2,
      (p[2] + q[2]) / 2,
    ];
    const len = 0.6 + rng() * 1.6;
    const pieces = 3;
    const outX =
      (cur[0] - centroid.x) /
      (Math.hypot(cur[0] - centroid.x, cur[2] - centroid.z) || 1);
    const outZ =
      (cur[2] - centroid.z) /
      (Math.hypot(cur[0] - centroid.x, cur[2] - centroid.z) || 1);
    let radius = 0.05 + rng() * 0.03;
    for (let s = 0; s < pieces; s++) {
      const next: [number, number, number] = [
        cur[0] + outX * (0.06 + rng() * 0.1) + (rng() - 0.5) * 0.15,
        cur[1] - len / pieces,
        cur[2] + outZ * (0.06 + rng() * 0.1) + (rng() - 0.5) * 0.15,
      ];
      roots.push({ a: cur, b: next, radius });
      cur = next;
      radius *= 0.7;
    }
  }

  return {
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    roots,
    centroid,
    profile,
    depth,
  };
}
