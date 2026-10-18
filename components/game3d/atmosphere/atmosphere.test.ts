import { describe, expect, it } from "vitest";

import { footstepSurface, musicForIsland } from "../audio/mix";
import type { WalkCell } from "../logic/walk-grid";
import type { Surface, WalkWorld } from "../logic/walk-world";
import { nearestAnchors } from "./anchors";
import {
  blendAt,
  dominantPreset,
  hourForMode,
  nextMode,
  parseTimeParam,
  TIME_MODES,
  wrapHour,
} from "./time-of-day";
import {
  gustAt,
  parseWeatherParam,
  planWeather,
  RAIN_RAMP,
  rainAmount,
} from "./weather";

describe("time of day", () => {
  it("holds sunset through the evening and night after dark", () => {
    expect(dominantPreset(18)).toBe("sunset");
    expect(dominantPreset(19.4)).toBe("sunset");
    expect(dominantPreset(23)).toBe("night");
    expect(dominantPreset(2)).toBe("night");
    expect(dominantPreset(6.5)).toBe("dawn");
    expect(dominantPreset(12)).toBe("day");
  });

  it("blends smoothly between neighbouring looks", () => {
    const b = blendAt(7.75);
    expect(b.a).toBe("dawn");
    expect(b.b).toBe("day");
    expect(b.t).toBeGreaterThan(0.3);
    expect(b.t).toBeLessThan(0.7);
    expect(blendAt(12).t).toBe(0);
  });

  it("wraps hours and follows the local clock in auto mode", () => {
    expect(wrapHour(25)).toBe(1);
    expect(wrapHour(-1)).toBe(23);
    expect(hourForMode("auto", new Date(2026, 0, 1, 14, 30))).toBe(14.5);
    expect(hourForMode("night", new Date(2026, 0, 1, 14, 30))).toBe(23);
  });

  it("cycles the toggle through auto then each preset", () => {
    let m = TIME_MODES[0] ?? "auto";
    const seen = [m];
    for (let i = 0; i < 5; i++) seen.push((m = nextMode(m)));
    expect(seen).toEqual(["auto", "dawn", "day", "sunset", "night", "auto"]);
  });

  it("parses ?time=", () => {
    expect(parseTimeParam("night")).toEqual({ mode: "night" });
    expect(parseTimeParam("7.5")).toEqual({ hour: 7.5 });
    expect(parseTimeParam("noon")).toBeNull();
    expect(parseTimeParam(null)).toBeNull();
  });
});

describe("weather", () => {
  it("rains on about one visit in four", () => {
    let s = 7;
    const rand = (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    let rainy = 0;
    for (let i = 0; i < 4000; i++) if (planWeather(rand).rainy) rainy++;
    expect(rainy / 4000).toBeGreaterThan(0.2);
    expect(rainy / 4000).toBeLessThan(0.3);
  });

  it("ramps a shower in and out", () => {
    const plan = { rainy: true, start: 30, duration: 100 };
    expect(rainAmount(plan, 10)).toBe(0);
    expect(rainAmount(plan, 30 + RAIN_RAMP / 2)).toBeCloseTo(0.5);
    expect(rainAmount(plan, 80)).toBe(1);
    expect(rainAmount(plan, 135)).toBeCloseTo(0.5);
    expect(rainAmount(plan, 200)).toBe(0);
  });

  it("honours the debug override", () => {
    expect(
      rainAmount(
        planWeather(() => 0.9, "rain"),
        0
      )
    ).toBe(1);
    expect(planWeather(() => 0, "clear").rainy).toBe(false);
    expect(parseWeatherParam("rain")).toBe("rain");
    expect(parseWeatherParam("snow")).toBeNull();
  });

  it("keeps gusts within 0..1", () => {
    for (let t = 0; t < 300; t += 0.7) {
      const g = gustAt(t, t > 150 ? 1 : 0);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
});

describe("anchors and sound choices", () => {
  it("finds the nearest anchors in order without allocating", () => {
    const pts = [
      { x: 10, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      { x: -2, y: 0, z: 0 },
    ];
    const out: { x: number; y: number; z: number }[] = [];
    const dist: number[] = [];
    const n = nearestAnchors(pts, 0, 0, 3, out, dist);
    expect(n).toBe(3);
    expect(out.slice(0, n).map((p) => p.x)).toEqual([1, -2, 5]);
  });

  it("maps islands to music beds", () => {
    expect(musicForIsland("home")).toBe("meadow");
    expect(musicForIsland("onyx")).toBe("dusk");
    expect(musicForIsland(null)).toBe("meadow");
  });

  it("picks footsteps by surface", () => {
    const walk = {
      bridges: [{ id: "b1", style: "rope" }],
    } as unknown as WalkWorld;
    const cell = (tile: string, deck = false): WalkCell =>
      ({ q: 0, r: 0, tile, deck }) as unknown as WalkCell;
    const on = (
      c: WalkCell | null,
      bridgeId: string | null = null
    ): Surface => ({
      y: 0,
      islandId: "home",
      bridgeId,
      cell: c,
      t: 0,
    });
    expect(footstepSurface(on(null, "b1"), walk)).toBe("wood");
    expect(footstepSurface(on(cell("hex-grass")), walk)).toBe("grass");
    expect(footstepSurface(on(cell("hex-road-a")), walk)).toBe("path");
    expect(footstepSurface(on(cell("hex-grass", true)), walk)).toBe("wood");
    expect(
      footstepSurface(on(cell("hex-grass")), walk, new Set(["home/0,0"]))
    ).toBe("stone");
  });
});
