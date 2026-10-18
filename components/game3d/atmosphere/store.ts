/**
 * Shared atmosphere state: the time mode picked in the UI (auto or a preset), the debug
 * hour override, and the live values the scene writes every frame (rain, gusts, night)
 * for the other systems (particles, audio). A module singleton like `gameEvents`, so the
 * React overlays and the 3D scene talk without props.
 */

import type { TimeMode } from "./time-of-day";
import type { WeatherOverride } from "./weather";

type Listener = () => void;

export type AtmosphereState = {
  mode: TimeMode;
  /** Debug slider / ?time=<hour>: forces this hour (null: follow `mode`). */
  debugHour: number | null;
  weatherOverride: WeatherOverride;
  /** Live (written by the atmosphere system each frame). */
  hour: number;
  /** 0..1 */
  rain: number;
  gust: number;
  night: number;
  /** 0..1 how much the current look is daylight (birdsong). */
  daylight: number;
};

export const atmosphere: AtmosphereState = {
  mode: "auto",
  debugHour: null,
  weatherOverride: null,
  hour: 18,
  rain: 0,
  gust: 0,
  night: 0,
  daylight: 1,
};

const listeners = new Set<Listener>();

export function subscribeAtmosphere(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setTimeMode(mode: TimeMode): void {
  atmosphere.mode = mode;
  atmosphere.debugHour = null;
  for (const cb of listeners) cb();
}

export function setDebugHour(hour: number | null): void {
  atmosphere.debugHour = hour;
  for (const cb of listeners) cb();
}

export function getTimeMode(): TimeMode {
  return atmosphere.mode;
}
