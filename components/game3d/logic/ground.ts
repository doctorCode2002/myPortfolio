/**
 * Continuous ground functions in world space, shared by the grass skin, the island lip
 * and the walk grid so neighbouring pieces always agree. Pure.
 */

import { valueNoise2 } from "./noise";

export type Rgb = [number, number, number];

/** sRGB hex to linear rgb (vertex colours are linear in three). */
export function srgbToLinear(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

export const MEADOW = {
  light: srgbToLinear("#a3cf7c"),
  mid: srgbToLinear("#8cc06a"),
  dark: srgbToLinear("#74ab58"),
  warm: srgbToLinear("#b5cf72"),
  lipSide: srgbToLinear("#5e9549"),
  soil: srgbToLinear("#6b4a33"),
};

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Soft meadow colour at a world point: broad patches plus fine speckle, no grid. */
export function meadowColor(x: number, z: number): Rgb {
  const broad =
    valueNoise2(x * 0.11, z * 0.11, 17) * 0.65 +
    valueNoise2(x * 0.27, z * 0.27, 23) * 0.35;
  const fine = valueNoise2(x * 0.9, z * 0.9, 31);
  let c = mix(MEADOW.dark, MEADOW.light, broad);
  c = mix(c, MEADOW.mid, 0.25);
  const warm = Math.max(
    0,
    (valueNoise2(x * 0.07 + 40, z * 0.07, 5) - 0.62) * 2.2
  );
  c = mix(c, MEADOW.warm, Math.min(0.5, warm));
  const k = 0.94 + fine * 0.1;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** Gentle ground undulation (metres) for islands that opt into `heightJitter`. */
export function groundJitter(x: number, z: number, amplitude: number): number {
  if (!amplitude) return 0;
  return (valueNoise2(x * 0.35, z * 0.35, 71) - 0.5) * 2 * amplitude;
}

export const DUNE = {
  light: srgbToLinear("#ecd29c"),
  mid: srgbToLinear("#e0c088"),
  dark: srgbToLinear("#cfa86f"),
  warm: srgbToLinear("#f1cf8f"),
  lipSide: srgbToLinear("#c79a62"),
  soil: srgbToLinear("#9c6f45"),
};

/** Warm sand at a world point (desert islands and sand-tinted hexes). */
export function sandColor(x: number, z: number): Rgb {
  const broad =
    valueNoise2(x * 0.13, z * 0.13, 41) * 0.7 +
    valueNoise2(x * 0.31, z * 0.31, 43) * 0.3;
  const fine = valueNoise2(x * 1.1, z * 1.1, 47);
  let c = mix(DUNE.dark, DUNE.light, broad);
  c = mix(c, DUNE.mid, 0.2);
  const k = 0.95 + fine * 0.08;
  return [c[0] * k, c[1] * k, c[2] * k];
}

export type GroundPalette = "meadow" | "sand";

export function groundColor(palette: GroundPalette, x: number, z: number): Rgb {
  return palette === "sand" ? sandColor(x, z) : meadowColor(x, z);
}

export function groundSide(palette: GroundPalette): { lip: Rgb; soil: Rgb } {
  return palette === "sand"
    ? { lip: DUNE.lipSide, soil: DUNE.soil }
    : { lip: MEADOW.lipSide, soil: MEADOW.soil };
}

/** The island's default ground palette: sand for desert biomes and sand undersides. */
export function islandPalette(island: {
  biome?: string;
  underside?: { style?: string };
}): GroundPalette {
  return island.biome === "desert" || island.underside?.style === "sand"
    ? "sand"
    : "meadow";
}
