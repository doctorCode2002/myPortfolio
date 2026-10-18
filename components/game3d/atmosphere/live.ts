import * as THREE from "three";

import {
  LOOKS,
  TIME_PRESETS,
  type AtmosphereLook,
  type LookBlend,
  type TimePreset,
} from "./time-of-day";

const COLOR_KEYS = [
  "zenith",
  "upper",
  "horizonSun",
  "horizonAway",
  "sunGlow",
  "haze",
  "deep",
  "cloud",
  "sunColor",
  "hemiSky",
  "hemiGround",
  "ambientColor",
  "fog",
  "cloudColor",
  "cloudEmissive",
] as const;
const NUMBER_KEYS = [
  "sunIntensity",
  "sunDisc",
  "hemiIntensity",
  "ambientIntensity",
  "fogNear",
  "fogFar",
  "exposure",
  "cloudGlow",
  "stars",
  "night",
  "mist",
] as const;

type ColorKey = (typeof COLOR_KEYS)[number];
type NumberKey = (typeof NUMBER_KEYS)[number];

/** A look in render form: linear THREE colours, numbers and the light direction. */
export type LiveLook = Record<ColorKey, THREE.Color> &
  Record<NumberKey, number> & { sunDir: THREE.Vector3 };

function toLive(look: AtmosphereLook): LiveLook {
  const out = { sunDir: new THREE.Vector3() } as LiveLook;
  for (const k of COLOR_KEYS) out[k] = new THREE.Color(look[k]);
  for (const k of NUMBER_KEYS) out[k] = look[k];
  out.sunDir.set(...look.sunDir).normalize();
  return out;
}

const PRESETS = Object.fromEntries(
  TIME_PRESETS.map((p) => [p, toLive(LOOKS[p])])
) as Record<TimePreset, LiveLook>;

/** The look currently on screen; shader uniforms point straight at these objects. */
export const live: LiveLook = toLive(LOOKS.sunset);
/** Where `live` is heading (eased towards each frame). */
const target: LiveLook = toLive(LOOKS.sunset);

const RAIN_SKY = new THREE.Color("#8d96a8");
const RAIN_SKY_NIGHT = new THREE.Color("#1a2238");
const tmp = new THREE.Color();

/** Blend two presets into `target`, then darken and grey it for rain. */
export function setTarget(blend: LookBlend, rain: number): void {
  const a = PRESETS[blend.a];
  const b = PRESETS[blend.b];
  const t = blend.t;
  for (const k of COLOR_KEYS) target[k].copy(a[k]).lerp(b[k], t);
  for (const k of NUMBER_KEYS) target[k] = a[k] + (b[k] - a[k]) * t;
  target.sunDir.copy(a.sunDir).lerp(b.sunDir, t).normalize();
  if (rain > 0) {
    tmp.copy(RAIN_SKY).lerp(RAIN_SKY_NIGHT, target.night);
    const g = rain * 0.6;
    for (const k of [
      "zenith",
      "upper",
      "horizonSun",
      "horizonAway",
      "haze",
      "deep",
      "cloud",
      "fog",
      "cloudColor",
    ] as const)
      target[k].lerp(tmp, g);
    target.sunGlow.multiplyScalar(1 - rain * 0.7);
    target.sunIntensity *= 1 - rain * 0.55;
    target.sunDisc *= 1 - rain;
    target.stars *= 1 - rain;
    target.hemiIntensity *= 1 - rain * 0.12;
    target.fogNear *= 1 - rain * 0.4;
    target.fogFar *= 1 - rain * 0.3;
    target.cloudGlow *= 1 - rain * 0.5;
    target.exposure *= 1 - rain * 0.06;
  }
}

/** Ease `live` towards the target; k is the blend factor this frame (0..1). */
export function easeLive(k: number): void {
  for (const key of COLOR_KEYS) live[key].lerp(target[key], k);
  for (const key of NUMBER_KEYS) live[key] += (target[key] - live[key]) * k;
  live.sunDir.lerp(target.sunDir, k).normalize();
}

/** Jump straight to the target (first frame). */
export function snapLive(): void {
  easeLive(1);
}
