import { describe, expect, it } from "vitest";

import { ISLANDS_3D } from "@/content/islands3d";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";
import { BRIDGES, ISLANDS } from "@/lib/content/world";
import { readModelBoundsFromDisk } from "../logic/bounds.node";
import {
  ACHIEVEMENTS,
  achievementMet,
  emptyProgress,
  parseProgress,
} from "../meta/progress";
import { canStand } from "../logic/collision";
import { cablePoint } from "../logic/zipline";
import { surfaceAt } from "../logic/walk-world";
import { buildGameWorld, PLAYER_RADIUS_HEX } from "../logic/world-layout";
import {
  createRuntime,
  onFoot,
  setDriving,
  setMoveMode,
  type MoveMode,
} from "../runtime";
import {
  BALLOON,
  buildBalloonWorld,
  canBoard,
  canTryLanding,
  createBalloonState,
  exitTarget,
  findParking,
  floorAt,
  need,
  parkingAt,
  startAutopilot,
  stepAutopilot,
  stepFree,
  tourLabel,
  tourPoint,
  windAt,
  WIND_DIR,
  type FreeInput,
} from "./balloon-logic";

const manifest = readManifestFromDisk();
const MAYORS = Object.fromEntries(
  ISLANDS.map((i) => [
    i.id,
    i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
  ])
);
const world = buildGameWorld(ISLANDS_3D, BRIDGES, MAYORS, manifest, {
  bounds: readModelBoundsFromDisk(ISLANDS_3D, manifest),
});
const radius = PLAYER_RADIUS_HEX * world.hexWidth;
const built = buildBalloonWorld(world, manifest, radius);
if (!built) throw new Error("no balloon field");
const { env, field, tour } = built;
const ISLAND_IDS = [
  "home",
  "khidmty",
  "civicmind",
  "onyx",
  "saleh",
  "eyad",
  "workshop",
  "waco",
];
const NO_WIND = { x: 0, z: 0 };

/** A point over the open void (no island, deck or cable under the balloon). */
function voidPoint(): { x: number; z: number } {
  for (let r = 14; r < 40; r += 1)
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (need(env, x, z) === -Infinity && surfaceAt(world.walk, x, z) === null)
        return { x, z };
    }
  throw new Error("no void");
}
const VOID = voidPoint();

function input(lift: number, dx = 0, dz = 0): FreeInput {
  return { lift, dx, dz };
}

describe("balloon field", () => {
  it("sits on home's south-west lobe, clear for the basket and the envelope", () => {
    expect(field.islandId).toBe("home");
    expect(field.x).toBeLessThan(-3);
    expect(field.z).toBeGreaterThan(12);
    expect(need(env, field.x, field.z)).toBeLessThanOrEqual(field.y + 0.02);
  });

  it("can be reached on foot from the spawn, and the walker steps out onto ground", () => {
    const e = field.exit;
    expect(canStand(world.walk, e.x, e.z, radius, e.y)).not.toBeNull();
    const s = surfaceAt(world.walk, e.x, e.z);
    expect(s?.islandId).toBe("home");
  });

  it("keeps the west lookout and its return pad free", () => {
    for (const l of world.movement.lookouts.filter(
      (o) => o.islandId === "home"
    ))
      expect(Math.hypot(l.x - field.x, l.z - field.z)).toBeGreaterThan(
        BALLOON.envR + 1
      );
  });
});

describe("scenic tour", () => {
  it("starts and ends on the field", () => {
    const n = tour.n - 1;
    expect(tour.xs[0]).toBeCloseTo(field.x, 5);
    expect(tour.zs[0]).toBeCloseTo(field.z, 5);
    expect(tour.ys[0]).toBeCloseTo(field.y, 5);
    expect(tour.xs[n]).toBeCloseTo(field.x, 5);
    expect(tour.zs[n]).toBeCloseTo(field.z, 5);
    expect(tour.ys[n]).toBeCloseTo(field.y, 5);
  });

  it("takes about 90-120 seconds, and time only moves forward", () => {
    expect(tour.duration).toBeGreaterThanOrEqual(90);
    expect(tour.duration).toBeLessThanOrEqual(120);
    for (let i = 1; i < tour.n; i++)
      expect(tour.ts[i] as number).toBeGreaterThan(tour.ts[i - 1] as number);
  });

  it("visits all eight islands, passing near each one", () => {
    const ids = tour.passes.map((p) => p.islandId).sort();
    expect(ids).toEqual([...ISLAND_IDS].sort());
    for (const isl of env.islands) {
      let best = Infinity;
      for (let i = 0; i < tour.n; i++)
        best = Math.min(
          best,
          Math.hypot(
            (tour.xs[i] as number) - isl.landmark.x,
            (tour.zs[i] as number) - isl.landmark.z
          )
        );
      expect(best, isl.id).toBeLessThan(isl.radius);
    }
  });

  it("rises high for the panorama", () => {
    let top = -Infinity;
    for (let i = 0; i < tour.n; i++) top = Math.max(top, tour.ys[i] as number);
    expect(top).toBeGreaterThan(env.topY + 18);
    expect(top).toBeLessThan(env.ceiling);
  });

  it("keeps clear of terrain, buildings, props, bridges and the cable everywhere", () => {
    let worst = Infinity;
    let worstAway = Infinity;
    const p = { x: 0, y: 0, z: 0 };
    // Every sample, and points between samples (sampled by time).
    for (let i = 0; i < tour.n; i++) {
      const c =
        (tour.ys[i] as number) -
        need(env, tour.xs[i] as number, tour.zs[i] as number);
      worst = Math.min(worst, c);
      const fromField = Math.hypot(
        (tour.xs[i] as number) - field.x,
        (tour.zs[i] as number) - field.z
      );
      if (fromField > 2) worstAway = Math.min(worstAway, c);
    }
    let hint = 0;
    for (let t = 0; t <= tour.duration; t += 0.05) {
      hint = tourPoint(tour, t, p, hint);
      worst = Math.min(worst, p.y - need(env, p.x, p.z));
    }
    expect(worst).toBeGreaterThanOrEqual(-1e-6);
    expect(worstAway).toBeGreaterThan(1.5);
  });

  it("passes above the bridges and the zipline cable", () => {
    const c = { x: 0, y: 0, z: 0 };
    for (const line of world.movement.ziplines) {
      for (let k = 0; k <= 20; k++) {
        cablePoint(line, k / 20, c);
        for (let i = 0; i < tour.n; i++) {
          const d = Math.hypot(
            (tour.xs[i] as number) - c.x,
            (tour.zs[i] as number) - c.z
          );
          if (d < BALLOON.envR)
            expect(tour.ys[i] as number).toBeGreaterThan(c.y);
        }
      }
    }
  });

  it("names the island being passed", () => {
    for (const p of tour.passes) expect(tourLabel(tour, p.t)).toBe(p.islandId);
    expect(tourLabel(tour, 0)).toBeNull();
  });
});

describe("free flight", () => {
  it("climbs with the burner and sinks with the vent, at a gentle rate", () => {
    const s = createBalloonState(field.x, field.y + 12, field.z);
    for (let i = 0; i < 300; i++) stepFree(env, s, input(1), NO_WIND, 1 / 60);
    expect(s.vy).toBeGreaterThan(0.6);
    expect(s.vy).toBeLessThanOrEqual(BALLOON.climb + 1e-9);
    expect(s.burn).toBeGreaterThan(0.9);
    const y = s.y;
    for (let i = 0; i < 300; i++) stepFree(env, s, input(-1), NO_WIND, 1 / 60);
    expect(s.y).toBeLessThan(y);
    expect(s.vy).toBeLessThan(-0.6);
    expect(s.vy).toBeGreaterThanOrEqual(-BALLOON.vent - 1e-9);
  });

  it("drifts slowly with inertia, never faster than the top speed", () => {
    const s = createBalloonState(field.x, env.topY + 20, field.z);
    stepFree(env, s, input(0, 1, 0), NO_WIND, 1 / 60);
    expect(s.vx).toBeLessThan(0.2);
    for (let i = 0; i < 60 * 8; i++)
      stepFree(env, s, input(0, 1, 0), NO_WIND, 1 / 60);
    expect(s.vx).toBeGreaterThan(3.5);
    expect(s.vx).toBeLessThanOrEqual(BALLOON.maxSpeed + 1e-9);
    // Let go: it keeps drifting for a while.
    for (let i = 0; i < 30; i++) stepFree(env, s, input(0), NO_WIND, 1 / 60);
    expect(s.vx).toBeGreaterThan(2);
  });

  it("the wind pushes gently, more in gusts and rain", () => {
    const w = { x: 0, z: 0 };
    windAt(0, 0, w);
    const calm = Math.hypot(w.x, w.z);
    windAt(1, 1, w);
    const storm = Math.hypot(w.x, w.z);
    expect(calm).toBeGreaterThan(0);
    expect(storm).toBeGreaterThan(calm * 3);
    expect(storm).toBeLessThan(2.5);
    const s = createBalloonState(0, env.topY + 20, 0);
    windAt(1, 0, w);
    for (let i = 0; i < 120; i++) stepFree(env, s, input(0), w, 1 / 60);
    expect(s.x).toBeGreaterThan(0.5 * WIND_DIR.x);
    expect(s.z).toBeGreaterThan(0.5 * WIND_DIR.z);
  });

  it("never sinks below the island tops over the void: it burns on its own", () => {
    const s = createBalloonState(VOID.x, env.voidFloor + 2, VOID.z);
    let burned = false;
    for (let i = 0; i < 60 * 30; i++) {
      stepFree(env, s, input(-1), NO_WIND, 1 / 60);
      burned ||= s.autoBurn;
      expect(s.y).toBeGreaterThan(env.voidFloor - 0.8);
    }
    expect(burned).toBe(true);
    expect(floorAt(env, VOID.x, VOID.z)).toBe(env.voidFloor);
  });

  it("stops at the ceiling", () => {
    const s = createBalloonState(0, env.ceiling - 1, 0);
    let hit = false;
    for (let i = 0; i < 60 * 10; i++)
      hit = stepFree(env, s, input(1), NO_WIND, 1 / 60).ceiling || hit;
    expect(hit).toBe(true);
    expect(s.y).toBeLessThanOrEqual(env.ceiling + 1e-9);
  });

  it("can't fly into a building: the drift is refused", () => {
    // Low next to the castle on home's north plateau (its landmark).
    const home = env.islands.find((i) => i.id === "home");
    if (!home) throw new Error("home");
    const L = home.landmark;
    const s = createBalloonState(L.x, 0, L.z + 9);
    s.y = need(env, s.x, s.z) + 0.05;
    expect(need(env, L.x, L.z)).toBeGreaterThan(s.y);
    let blocked = false;
    for (let i = 0; i < 60 * 8; i++) {
      blocked = stepFree(env, s, input(0, 0, -1), NO_WIND, 1 / 60).blocked
        ? true
        : blocked;
      expect(s.y).toBeGreaterThanOrEqual(need(env, s.x, s.z) - 1e-9);
    }
    expect(blocked).toBe(true);
    expect(Math.hypot(s.x - L.x, s.z - L.z)).toBeGreaterThan(2);
  });

  it("never ends up inside anything on a long random flight", () => {
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const s = createBalloonState(field.x, field.y, field.z);
    const w = { x: 0, z: 0 };
    let inp = input(0);
    for (let i = 0; i < 60 * 240; i++) {
      if (i % 180 === 0)
        inp = input(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      windAt(rnd() * 0.5, 0, w);
      stepFree(env, s, inp, w, 1 / 60);
      expect(s.y).toBeGreaterThanOrEqual(need(env, s.x, s.z) - 1e-9);
      expect(s.y).toBeLessThanOrEqual(env.ceiling + 1e-9);
    }
  });
});

describe("landing finder", () => {
  it("parks on the field and on most islands, each with a way out on foot", () => {
    const with_ = env.islands.filter((i) => i.landing);
    expect(with_.length).toBeGreaterThanOrEqual(5);
    for (const isl of with_) {
      const l = isl.landing;
      if (!l) continue;
      expect(l.islandId).toBe(isl.id);
      expect(need(env, l.x, l.z)).toBeLessThanOrEqual(l.y + 0.02);
      expect(
        canStand(world.walk, l.exit.x, l.exit.z, radius, l.exit.y)
      ).not.toBeNull();
    }
  });

  it("keeps clear of the mayors and the doors", () => {
    for (const isl of env.islands) {
      const l = isl.landing;
      if (!l || l === field) continue;
      for (const i of world.interactables) {
        if (i.kind === "vehicle") continue;
        expect(
          Math.hypot(l.x - i.x, l.z - i.z),
          `${isl.id} vs ${i.id}`
        ).toBeGreaterThan(BALLOON.basketR + 1.1);
      }
    }
  });

  it("finds nothing over the void, nor on water or under a building", () => {
    expect(findParking(env, VOID.x, VOID.z, 1)).toBeNull();
    const home = env.islands.find((i) => i.id === "home");
    if (!home) throw new Error("home");
    expect(parkingAt(env, home.landmark.x, home.landmark.z)).toBeNull();
  });

  it("lands only when low over island ground", () => {
    const s = createBalloonState(field.x, field.y + 2, field.z);
    expect(canTryLanding(env, s)).toBe(true);
    s.y = field.y + 8;
    expect(canTryLanding(env, s)).toBe(false);
    const v = createBalloonState(VOID.x, 5, VOID.z);
    expect(canTryLanding(env, v)).toBe(false);
  });

  it("the autopilot flies to a landing spot without touching anything", () => {
    const to = env.islands.find((i) => i.id === "saleh")?.landing;
    if (!to) throw new Error("saleh landing");
    const s = createBalloonState(field.x, field.y, field.z);
    const a = startAutopilot(env, s, to);
    let done = false;
    for (let i = 0; i < 60 * 120 && !done; i++) {
      done = stepAutopilot(s, a, 1 / 60);
      expect(s.y).toBeGreaterThanOrEqual(need(env, s.x, s.z) - 1e-9);
    }
    expect(done).toBe(true);
    expect(s.x).toBeCloseTo(to.x, 5);
    expect(s.z).toBeCloseTo(to.z, 5);
    expect(s.y).toBeCloseTo(to.y, 5);
  });

  it("an early exit lands on the nearest island, or back on the field over the void", () => {
    const saleh = env.islands.find((i) => i.id === "saleh");
    if (!saleh?.landing) throw new Error("saleh");
    expect(exitTarget(env, saleh.x + 1, saleh.z, field)).toBe(saleh.landing);
    expect(exitTarget(env, VOID.x, VOID.z, field)).toBe(field);
    // A crowded island without room hands over to a neighbour's spot.
    const crowded = env.islands.find((i) => !i.landing);
    if (crowded) {
      const t = exitTarget(env, crowded.x, crowded.z, field);
      expect(t.islandId).not.toBe(crowded.id);
    }
  });
});

describe("mode exclusivity", () => {
  it("boards only on foot", () => {
    expect(canBoard("walk", false, false)).toBe(true);
    for (const m of ["drive", "glide", "jump", "zip", "balloon"] as const)
      expect(canBoard(m, false, false)).toBe(false);
    expect(canBoard("walk", true, false)).toBe(false);
    expect(canBoard("walk", false, true)).toBe(false);
  });

  it("ballooning replaces every other mode, and blocks the on-foot actions", () => {
    const rt = createRuntime(false);
    const modes: MoveMode[] = ["walk", "glide", "jump", "zip", "balloon"];
    for (const m of modes) {
      setMoveMode(rt, m);
      expect(rt.move.mode).toBe(m);
    }
    setMoveMode(rt, "balloon");
    expect(onFoot(rt)).toBe(false);
    setMoveMode(rt, "walk");
    expect(onFoot(rt)).toBe(true);
    setDriving(rt, true);
    expect(rt.move.mode).toBe("drive");
    expect(onFoot(rt)).toBe(false);
  });
});

describe("above the clouds", () => {
  it("is an achievement earned by the balloon's sky flag, and it persists", () => {
    expect(ACHIEVEMENTS).toContain("aboveClouds");
    const rules = { mayorIslands: [], bridgeIds: [] };
    const p = emptyProgress();
    expect(achievementMet(p, "aboveClouds", rules)).toBe(false);
    p.sky = true;
    expect(achievementMet(p, "aboveClouds", rules)).toBe(true);
    expect(parseProgress(JSON.stringify(p)).sky).toBe(true);
  });
});
