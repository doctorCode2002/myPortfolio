/**
 * Generated low-poly rock underside for a floating island: an inverted noisy cone fitted
 * to the island outline, flat-shaded with 2-3 colour bands, plus hanging roots.
 * Produces plain typed arrays (island-local coordinates); the renderer wraps them in a
 * BufferGeometry. Pure: no three or react imports.
 */

import { MEADOW, meadowColor, type Rgb } from "./ground";
import { createRng, valueNoise2 } from "./noise";
import type { Point2 } from "./hex";

export type UndersideStyle = "rock" | "sand";

export type UndersideOptions = {
  depth?: number;
  seed?: number;
  style?: UndersideStyle;
  /** y of the tiles' top surface (the grass lip sits here). */
  surfaceY?: number;
  /** y where the rock starts (below the lip and soil band; defaults to surfaceY - 0.6). */
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

const PALETTES: Record<UndersideStyle, Rgb[]> = {
  // soil lip, warm rock, deep cool rock
  rock: [
    [0.2, 0.12, 0.07],
    [0.42, 0.3, 0.22],
    [0.24, 0.21, 0.3],
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
  const segments = opts.segments ?? 40;
  const rings = opts.rings ?? 7;
  const surfaceY = opts.surfaceY ?? 0;
  const topY = opts.topY ?? surfaceY - 0.6;
  const style = opts.style ?? "rock";
  const palette = PALETTES[style];
  const rng = createRng(seed);
  const { centroid, profile } = outlineProfile(centres, size, segments);
  const maxR = Math.max(...profile, size);
  // Prominent by default: at least ~0.85x the island radius deep.
  const depth = Math.max(opts.depth ?? 0, maxR * 0.85, 3);

  const at = (
    i: number,
    scale: number,
    y: number
  ): [number, number, number] => {
    const ang = (i / segments) * Math.PI * 2;
    const r = (profile[i] ?? size) * scale;
    return [centroid.x + Math.cos(ang) * r, y, centroid.z + Math.sin(ang) * r];
  };

  const pos: number[] = [];
  const col: number[] = [];
  const jit = (c: Rgb, amount = 0.1): Rgb => {
    const k = 1 - amount / 2 + rng() * amount;
    return [c[0] * k, c[1] * k, c[2] * k];
  };
  const tri = (
    a: number[],
    b: number[],
    c: number[],
    color: Rgb | Rgb[]
  ): void => {
    pos.push(...a, ...b, ...c);
    const cs = Array.isArray(color[0])
      ? (color as Rgb[])
      : [color as Rgb, color as Rgb, color as Rgb];
    for (const v of cs) col.push(v[0], v[1], v[2]);
  };
  const quad = (
    a: number[],
    b: number[],
    c: number[],
    d: number[],
    color: Rgb
  ): void => {
    // a-b on the upper ring, c-d below (a above d, b above c)
    tri(a, b, d, color);
    tri(b, c, d, color);
  };

  // 1. Grass lip: a top band from just inside the edge hexes to slightly past the outline,
  //    coloured like the meadow, then an overhanging green side and a soil band.
  const lipGrass = (p: number[]): Rgb =>
    meadowColor(p[0] as number, p[2] as number);
  const inner = [] as number[][];
  const outer = [] as number[][];
  const over = [] as number[][];
  const soil = [] as number[][];
  for (let i = 0; i < segments; i++) {
    const n = valueNoise2(i * 0.6, 3.3, seed) - 0.5;
    inner.push(at(i, 0.9, surfaceY + 0.004));
    outer.push(at(i, 1.03 + n * 0.03, surfaceY + 0.004));
    over.push(at(i, 1.06 + n * 0.05, surfaceY - 0.22 - Math.abs(n) * 0.12));
    soil.push(at(i, 1.02 + n * 0.04, topY));
  }
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    const a = inner[i] as number[];
    const b = inner[j] as number[];
    const c = outer[j] as number[];
    const d = outer[i] as number[];
    // Upward-facing band (counter-clockwise seen from above).
    tri(a, b, c, [lipGrass(a), lipGrass(b), lipGrass(c)]);
    tri(a, c, d, [lipGrass(a), lipGrass(c), lipGrass(d)]);
    quad(
      outer[i] as number[],
      outer[j] as number[],
      over[j] as number[],
      over[i] as number[],
      jit(MEADOW.lipSide, 0.12)
    );
    quad(
      over[i] as number[],
      over[j] as number[],
      soil[j] as number[],
      soil[i] as number[],
      jit(palette[0] as Rgb, 0.14)
    );
  }

  // 2. Rock: rings from the soil band down to the tip, staying wide before tapering.
  const ringPts: number[][][] = [soil];
  for (let k = 1; k <= rings; k++) {
    const t = k / (rings + 1);
    const row: number[][] = [];
    for (let i = 0; i < segments; i++) {
      const n = valueNoise2(i * 0.45, k * 0.9, seed) - 0.5;
      const shrink = (1 - Math.pow(t, 1.5)) * (1 + n * 0.28);
      const y = topY - depth * Math.pow(t, 0.9) + n * depth * 0.07;
      row.push(at(i, Math.max(0.05, shrink) * 1.0, y));
    }
    ringPts.push(row);
  }
  const tip = [
    centroid.x + (rng() - 0.5) * maxR * 0.2,
    topY - depth * (1.02 + rng() * 0.12),
    centroid.z + (rng() - 0.5) * maxR * 0.2,
  ];
  const bandColor = (t: number): Rgb => {
    // Warm rock fading to cool deep rock, darkest near the tip.
    const p1 = palette[1] as Rgb;
    const p2 = palette[2] as Rgb;
    const m = Math.min(1, Math.max(0, (t - 0.25) / 0.5));
    const base: Rgb = [
      p1[0] + (p2[0] - p1[0]) * m,
      p1[1] + (p2[1] - p1[1]) * m,
      p1[2] + (p2[2] - p1[2]) * m,
    ];
    const dark = 1 - Math.max(0, t - 0.6) * 0.9;
    const stripe = Math.floor(t * 9) % 2 === 0 ? 1.0 : 0.9;
    return jit(
      [
        base[0] * dark * stripe,
        base[1] * dark * stripe,
        base[2] * dark * stripe,
      ],
      0.14
    );
  };
  for (let k = 0; k < rings; k++) {
    const up = ringPts[k] as number[][];
    const dn = ringPts[k + 1] as number[][];
    const t = (k + 0.5) / (rings + 1);
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      tri(
        up[i] as number[],
        up[j] as number[],
        dn[i] as number[],
        bandColor(t)
      );
      tri(
        up[j] as number[],
        dn[j] as number[],
        dn[i] as number[],
        bandColor(t)
      );
    }
  }
  const last = ringPts[rings] as number[][];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    tri(last[i] as number[], last[j] as number[], tip, bandColor(0.97));
  }
  // A soil cap under the tiles so gaps never show the sky from below.
  const capC = [centroid.x, topY + 0.02, centroid.z];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    tri(
      capC,
      (soil[j] as number[]).map((v, idx) => (idx === 1 ? v + 0.02 : v)),
      (soil[i] as number[]).map((v, idx) => (idx === 1 ? v + 0.02 : v)),
      palette[0] as Rgb
    );
  }

  // 3. Hanging roots from the soil band.
  const roots: RootSegment[] = [];
  const rootCount = Math.max(5, Math.round(segments / 3));
  for (let n = 0; n < rootCount; n++) {
    const i = Math.floor(rng() * segments);
    const p = soil[i] as number[];
    let cur: [number, number, number] = [
      p[0] as number,
      (p[1] as number) + 0.1,
      p[2] as number,
    ];
    const len = 0.8 + rng() * 2.2;
    const pieces = 3;
    const ox = cur[0] - centroid.x;
    const oz = cur[2] - centroid.z;
    const ol = Math.hypot(ox, oz) || 1;
    let radius = 0.05 + rng() * 0.04;
    for (let s = 0; s < pieces; s++) {
      const next: [number, number, number] = [
        cur[0] + (ox / ol) * (0.05 + rng() * 0.12) + (rng() - 0.5) * 0.15,
        cur[1] - len / pieces,
        cur[2] + (oz / ol) * (0.05 + rng() * 0.12) + (rng() - 0.5) * 0.15,
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
