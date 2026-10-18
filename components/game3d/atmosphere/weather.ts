/**
 * Weather: an occasional light shower (about one visit in four, a few minutes long) and
 * wind gusts. Pure: no three or react imports.
 */

export type WeatherOverride = "clear" | "rain" | null;

export type WeatherPlan = {
  rainy: boolean;
  /** Seconds after the world loads when the shower starts. */
  start: number;
  /** Seconds of rain (at full strength between the ramps). */
  duration: number;
};

/** Chance that a visit gets a shower. */
export const RAIN_CHANCE = 0.25;
/** Fade in / out time of a shower (seconds). */
export const RAIN_RAMP = 10;

/** Decide this visit's weather; `rand` returns [0, 1). */
export function planWeather(
  rand: () => number,
  override: WeatherOverride = null
): WeatherPlan {
  if (override === "rain")
    return { rainy: true, start: -RAIN_RAMP, duration: 1e9 };
  if (override === "clear") return { rainy: false, start: 0, duration: 0 };
  const rainy = rand() < RAIN_CHANCE;
  return {
    rainy,
    start: 25 + rand() * 70,
    duration: 120 + rand() * 120,
  };
}

/** Rain strength 0..1 at `elapsed` seconds into the visit. */
export function rainAmount(plan: WeatherPlan, elapsed: number): number {
  if (!plan.rainy) return 0;
  const t = elapsed - plan.start;
  if (t <= 0) return plan.start === 0 ? 1 : 0;
  const end = plan.duration;
  if (t >= end + RAIN_RAMP) return 0;
  const up = Math.min(1, t / RAIN_RAMP);
  const down = t > end ? 1 - (t - end) / RAIN_RAMP : 1;
  return Math.max(0, Math.min(up, down));
}

/**
 * Wind gust strength 0..1 at time t (seconds): mostly calm, a gust every 15-30 seconds
 * that swells over a couple of seconds. Rain makes it gustier.
 */
export function gustAt(t: number, rain: number): number {
  const slow = Math.sin(t * 0.23) * 0.6 + Math.sin(t * 0.137 + 1.7) * 0.4;
  const swell = Math.max(0, slow - 0.35 + rain * 0.25) / (0.65 + rain * 0.25);
  const flutter = 0.85 + 0.15 * Math.sin(t * 2.1);
  return Math.min(1, swell * swell * flutter + rain * 0.25);
}

/** Parse ?weather=. */
export function parseWeatherParam(value: string | null): WeatherOverride {
  return value === "rain" || value === "clear" ? value : null;
}
