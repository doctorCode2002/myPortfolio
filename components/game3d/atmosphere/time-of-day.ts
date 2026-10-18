/**
 * Day/night cycle: four looks (dawn, day, sunset, night) keyed to the hour of the day,
 * and the blend between them for any hour. Pure: no three or react imports.
 *
 * By default the world follows the visitor's local clock. Sunset is the hero look and
 * holds through the evening (17:00 - 19:30).
 */

export type TimePreset = "dawn" | "day" | "sunset" | "night";
export type TimeMode = "auto" | TimePreset;

export const TIME_PRESETS: readonly TimePreset[] = [
  "dawn",
  "day",
  "sunset",
  "night",
];

/** The in-game toggle cycles through these. */
export const TIME_MODES: readonly TimeMode[] = ["auto", ...TIME_PRESETS];

/** A representative hour for each preset (used when a preset is forced). */
export const PRESET_HOUR: Readonly<Record<TimePreset, number>> = {
  dawn: 6.5,
  day: 12,
  sunset: 18.2,
  night: 23,
};

export type AtmosphereLook = {
  /** Sky gradient (sRGB hex). */
  zenith: string;
  upper: string;
  horizonSun: string;
  horizonAway: string;
  sunGlow: string;
  haze: string;
  deep: string;
  cloud: string;
  /** Directional light (the sun, or the moon at night). */
  sunColor: string;
  sunIntensity: number;
  /** Direction towards the light (not normalised). */
  sunDir: readonly [number, number, number];
  /** Sun disc in the sky (0 at night: the moon takes over). */
  sunDisc: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  fog: string;
  fogNear: number;
  fogFar: number;
  exposure: number;
  /** Cloud body and glow tint. */
  cloudColor: string;
  cloudEmissive: string;
  cloudGlow: number;
  /** 0..1: stars and moon visible. */
  stars: number;
  /** 0..1: lit windows, stronger lamps, fireflies. */
  night: number;
  /** 0..1: low ground mist (dawn). */
  mist: number;
};

/** The original hand-tuned sunset (scene/sky.tsx's SKY palette) is the "sunset" look. */
export const LOOKS: Readonly<Record<TimePreset, AtmosphereLook>> = {
  dawn: {
    zenith: "#3a5a8c",
    upper: "#7f9cc6",
    horizonSun: "#ffcfa8",
    horizonAway: "#c9c3dc",
    sunGlow: "#ffb48a",
    haze: "#d9cdd8",
    deep: "#8496bd",
    cloud: "#fbeee8",
    sunColor: "#ffd9b8",
    sunIntensity: 1.7,
    sunDir: [0.62, 0.28, 0.55],
    sunDisc: 1,
    hemiSky: "#b7c8e6",
    hemiGround: "#b39a86",
    hemiIntensity: 0.95,
    ambientColor: "#f0d6cc",
    ambientIntensity: 0.14,
    fog: "#d8ccd6",
    fogNear: 14,
    fogFar: 88,
    exposure: 0.98,
    cloudColor: "#fff3ee",
    cloudEmissive: "#f9d8cc",
    cloudGlow: 0.28,
    stars: 0,
    night: 0.1,
    mist: 1,
  },
  day: {
    zenith: "#2f6fc4",
    upper: "#5f9ee0",
    horizonSun: "#cfe6f7",
    horizonAway: "#b8d6f0",
    sunGlow: "#fff2d6",
    haze: "#c4dcef",
    deep: "#6f9fd2",
    cloud: "#ffffff",
    sunColor: "#fff4e2",
    sunIntensity: 2.6,
    sunDir: [-0.32, 0.86, 0.4],
    sunDisc: 1,
    hemiSky: "#bcd8f5",
    hemiGround: "#a88d6c",
    hemiIntensity: 1.15,
    ambientColor: "#ffffff",
    ambientIntensity: 0.12,
    fog: "#c4dcef",
    fogNear: 30,
    fogFar: 135,
    exposure: 1.0,
    cloudColor: "#ffffff",
    cloudEmissive: "#e8f1fa",
    cloudGlow: 0.22,
    stars: 0,
    night: 0,
    mist: 0,
  },
  sunset: {
    zenith: "#1d3766",
    upper: "#4a72a8",
    horizonSun: "#f8b487",
    horizonAway: "#b9a7d0",
    sunGlow: "#ff9a62",
    haze: "#c7b3c6",
    deep: "#6c82b3",
    cloud: "#f6e6e3",
    sunColor: "#ffd2a0",
    sunIntensity: 2.3,
    sunDir: [-0.56, 0.46, 0.69],
    sunDisc: 1,
    hemiSky: "#a9c8ec",
    hemiGround: "#c08d63",
    hemiIntensity: 1.05,
    ambientColor: "#f3c9b0",
    ambientIntensity: 0.12,
    fog: "#c7b3c6",
    fogNear: 24,
    fogFar: 110,
    exposure: 1.0,
    cloudColor: "#fff6ee",
    cloudEmissive: "#f7d9c2",
    cloudGlow: 0.25,
    stars: 0,
    night: 0.25,
    mist: 0,
  },
  night: {
    zenith: "#050b1f",
    upper: "#0e1f45",
    horizonSun: "#2b3f74",
    horizonAway: "#1d2a55",
    sunGlow: "#6f86c8",
    haze: "#22305a",
    deep: "#0c1736",
    cloud: "#4a5a86",
    sunColor: "#9fb6ff",
    sunIntensity: 0.6,
    // The moon: high, opposite the sunset sun.
    sunDir: [0.45, 0.72, -0.52],
    sunDisc: 0,
    hemiSky: "#34477e",
    hemiGround: "#1f1c2e",
    hemiIntensity: 0.6,
    ambientColor: "#6a7ab8",
    ambientIntensity: 0.14,
    fog: "#1c2850",
    fogNear: 22,
    fogFar: 100,
    exposure: 1.08,
    cloudColor: "#5a6a96",
    cloudEmissive: "#26345e",
    cloudGlow: 0.4,
    stars: 1,
    night: 1,
    mist: 0,
  },
};

/** Keyframes over the 24-hour clock; held looks between equal neighbours. */
const KEYS: readonly { h: number; p: TimePreset }[] = [
  { h: 0, p: "night" },
  { h: 4.5, p: "night" },
  { h: 6.5, p: "dawn" },
  { h: 9, p: "day" },
  { h: 16, p: "day" },
  { h: 17.2, p: "sunset" },
  { h: 19.6, p: "sunset" },
  { h: 21.2, p: "night" },
  { h: 24, p: "night" },
];

export type LookBlend = { a: TimePreset; b: TimePreset; t: number };

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Wrap any hour into [0, 24). */
export function wrapHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

/** The two looks around `hour` and the eased blend factor from a to b. */
export function blendAt(hour: number): LookBlend {
  const h = wrapHour(hour);
  for (let i = 0; i < KEYS.length - 1; i++) {
    const k0 = KEYS[i] as { h: number; p: TimePreset };
    const k1 = KEYS[i + 1] as { h: number; p: TimePreset };
    if (h >= k0.h && h <= k1.h) {
      const t = k1.h > k0.h ? (h - k0.h) / (k1.h - k0.h) : 0;
      return { a: k0.p, b: k1.p, t: k0.p === k1.p ? 0 : smooth(t) };
    }
  }
  return { a: "night", b: "night", t: 0 };
}

/** The look that dominates at `hour` (for labels). */
export function dominantPreset(hour: number): TimePreset {
  const { a, b, t } = blendAt(hour);
  return t < 0.5 ? a : b;
}

/** The hour to show for a mode: auto follows the local clock. */
export function hourForMode(mode: TimeMode, now: Date): number {
  if (mode === "auto") return now.getHours() + now.getMinutes() / 60;
  return PRESET_HOUR[mode];
}

/** The next mode of the in-game toggle. */
export function nextMode(mode: TimeMode): TimeMode {
  const i = TIME_MODES.indexOf(mode);
  return TIME_MODES[(i + 1) % TIME_MODES.length] ?? "auto";
}

/** Parse a ?time= value (a preset name or an hour 0-24). */
export function parseTimeParam(
  value: string | null
): { mode: TimeMode } | { hour: number } | null {
  if (!value) return null;
  if ((TIME_MODES as readonly string[]).includes(value))
    return { mode: value as TimeMode };
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 24 ? { hour: n } : null;
}
