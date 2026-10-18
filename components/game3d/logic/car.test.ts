import { describe, expect, it } from "vitest";

import { ISLANDS_3D } from "@/content/islands3d";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";
import { BRIDGES } from "@/lib/content/world";
import {
  breakProp,
  chunkPalette,
  createBreakStore,
  propClass,
  propScale,
  REGROW_DELAY_MS,
  REGROW_MS,
  REGROW_RETRY_MS,
  tickRegrow,
} from "./breakables";
import { readModelBoundsFromDisk } from "./bounds.node";
import {
  CAR,
  carFits,
  createCarEnv,
  createCarState,
  distanceToCar,
  findExitSpot,
  spotOccupied,
  stepCar,
  type CarInput,
} from "./car";
import { canStand } from "./collision";
import { hexSpiral } from "./hex";
import { buildRails, railDistance } from "./rails";
import type { Island3D } from "./types";
import { islandProblems, parseIsland3D } from "./validate-island";
import { buildWalkWorld, surfaceAt } from "./walk-world";
import { buildGameWorld, PLAYER_RADIUS_HEX } from "./world-layout";

const manifest = readManifestFromDisk();
const world = buildGameWorld(ISLANDS_3D, BRIDGES, {}, manifest, {
  bounds: readModelBoundsFromDisk(ISLANDS_3D, manifest),
});
const DT = 1 / 60;
const GAS: CarInput = { throttle: 1, steer: 0, handbrake: false };

function disc(
  id: string,
  radius: number,
  center: [number, number],
  extra: Partial<Island3D> = {}
): Island3D {
  return {
    id,
    center,
    hexes: hexSpiral({ q: 0, r: 0 }, radius).map((h) => ({
      ...h,
      tile: "hex-grass",
    })),
    spawns: { player: { q: 0, r: 0 } },
    ...extra,
  };
}

describe("breakable classification", () => {
  it("breaks vegetation and street furniture", () => {
    for (const name of [
      "tree-oak",
      "tree-pine-round-a",
      "plant-bush",
      "a-hedge",
      "fence-wood-straight",
      "fence-wood-straight-gate",
      "barrel",
      "crate-a-small",
      "lantern",
      "b-urn",
      "stump-round",
      "rock-small-a",
      "stall-bench",
    ])
      expect(propClass(name, manifest), name).toBe("breakable");
  });

  it("keeps buildings, landmarks and big rocks indestructible", () => {
    for (const name of [
      "building-castle-red",
      "building-tower-a-red",
      "building-home-a-red",
      "a-statue",
      "fountain-round-detail",
      "a-pavilion",
      "a-notice-board",
      "wall-straight",
      "b-town-hall",
      "building-bridge-a",
      "rock-large-b",
      "vehicle-car",
    ])
      expect(propClass(name, manifest), name).toBe("solid");
  });

  it("colours tree chunks green with a brown trunk piece", () => {
    const p = chunkPalette("tree-oak", manifest);
    expect(p[0]).toBe("#7a5236");
    expect(p.length).toBeGreaterThan(2);
    expect(chunkPalette("rock-small-a", manifest)[0]).toMatch(/^#[89ab]/);
  });

  it("lists home's trees and fences as props and nothing indestructible", () => {
    const home = [...world.props.values()].filter((p) => p.islandId === "home");
    expect(home.some((p) => p.model.startsWith("tree-"))).toBe(true);
    expect(home.some((p) => p.model.startsWith("fence-"))).toBe(true);
    for (const p of world.props.values())
      expect(propClass(p.model, manifest), p.model).toBe("breakable");
  });
});

describe("break store and regrowth", () => {
  it("hides a prop, regrows it after the delay with a scale-up, then blocks", () => {
    const store = createBreakStore();
    expect(breakProp(store, "home:3", 1000)).toBe(true);
    expect(breakProp(store, "home:3", 1100)).toBe(false);
    expect(propScale(store, "home:3", 2000)).toBe(0);
    expect(store.broken.has("home:3")).toBe(true);
    expect(tickRegrow(store, 1000 + REGROW_DELAY_MS - 1).started).toEqual([]);
    const t = 1000 + REGROW_DELAY_MS;
    expect(tickRegrow(store, t).started).toEqual(["home:3"]);
    expect(store.broken.has("home:3")).toBe(false);
    const mid = propScale(store, "home:3", t + REGROW_MS / 2);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(1.2);
    expect(tickRegrow(store, t + REGROW_MS).finished).toEqual(["home:3"]);
    expect(propScale(store, "home:3", t + REGROW_MS)).toBe(1);
  });

  it("waits while the spot is occupied", () => {
    const store = createBreakStore();
    breakProp(store, "k", 0);
    const r = tickRegrow(store, REGROW_DELAY_MS, () => false);
    expect(r.started).toEqual([]);
    expect(store.broken.get("k")).toBe(REGROW_DELAY_MS + REGROW_RETRY_MS);
    expect(
      tickRegrow(store, REGROW_DELAY_MS + REGROW_RETRY_MS, () => true).started
    ).toEqual(["k"]);
  });

  it("lets the player walk through a broken prop and blocks again on regrow", () => {
    const tree = [...world.props.values()].find(
      (p) => p.islandId === "home" && p.model.startsWith("tree-")
    );
    expect(tree).toBeDefined();
    if (!tree) return;
    const r = PLAYER_RADIUS_HEX * world.hexWidth;
    expect(canStand(world.walk, tree.x, tree.z, r)).toBeNull();
    const store = createBreakStore();
    const walk = { ...world.walk, broken: store.broken };
    breakProp(store, tree.key, 0);
    // Its own spot is free now (unless a neighbouring prop still covers it).
    const others = walk.islands
      .flatMap((g) => g.obstacles)
      .filter((o) => o.key !== tree.key);
    const covered = others.some(
      (o) => Math.hypot(o.x - tree.x, o.z - tree.z) < 0.6
    );
    if (!covered) expect(canStand(walk, tree.x, tree.z, r)).not.toBeNull();
    tickRegrow(store, REGROW_DELAY_MS);
    expect(canStand(walk, tree.x, tree.z, r)).toBeNull();
  });
});

describe("rails", () => {
  it("rings a lone island's rim and leaves the inside open", () => {
    const walk = buildWalkWorld([disc("a", 2, [0, 0])], []);
    const rails = buildRails(walk);
    expect(rails.length).toBeGreaterThan(0);
    expect(rails.every((r) => r.kind === "rim")).toBe(true);
    for (const r of rails) {
      const mx = (r.ax + r.bx) / 2;
      const mz = (r.az + r.bz) / 2;
      expect(Math.hypot(mx, mz)).toBeGreaterThan(4);
    }
    // Total rail length equals the outer perimeter: 30 edges of a radius-2 disc.
    const total = rails.reduce(
      (s, r) => s + Math.hypot(r.bx - r.ax, r.bz - r.az),
      0
    );
    expect(total).toBeCloseTo(30 * (2 / Math.sqrt(3)), 3);
  });

  it("puts rails around a pond", () => {
    const island = disc("a", 2, [0, 0]);
    island.hexes = island.hexes.map((h) =>
      h.q === 0 && h.r === 0 ? { ...h, tile: "hex-water" } : h
    );
    const rails = buildRails(buildWalkWorld([island], []));
    const inner = rails.filter(
      (r) => Math.hypot((r.ax + r.bx) / 2, (r.az + r.bz) / 2) < 1.2
    );
    expect(inner.length).toBeGreaterThanOrEqual(6);
  });

  it("opens the rim at a bridge and lines both sides of the bridge", () => {
    const a = disc("a", 1, [0, 0]);
    const b = disc("b", 1, [12, 0]);
    const walk = buildWalkWorld([a, b], [{ from: "a", to: "b" }]);
    const bridge = walk.bridges[0];
    expect(bridge).toBeDefined();
    if (!bridge) return;
    const rails = buildRails(walk);
    const br = rails.filter((r) => r.kind === "bridge");
    expect(br.length).toBeGreaterThan(4);
    // Both sides: rails on either side of the centre line, at the half width.
    const sides = new Set(br.map((r) => Math.sign((r.az + r.bz) / 2)));
    expect(sides).toEqual(new Set([-1, 1]));
    for (const r of br)
      expect(Math.abs((r.az + r.bz) / 2)).toBeCloseTo(
        bridge.halfWidth + 0.04,
        3
      );
    // No rail crosses the bridge's centre line (the mouth stays open).
    for (let x = bridge.a.x; x <= bridge.b.x; x += 0.25)
      for (const r of rails) expect(railDistance(r, x, 0)).toBeGreaterThan(0.5);
  });

  it("builds 1.8-hex-wide bridges whose deck lands over the rim", () => {
    for (const b of world.walk.bridges) {
      expect(b.halfWidth, b.id).toBeCloseTo(
        (world.hexWidth * 1.8) / 2 - 0.05,
        5
      );
      // The landings start inside the anchor hexes, before the rim.
      expect(b.t0 * b.length, b.id).toBeGreaterThan(0.2);
      expect(b.t0 * b.length, b.id).toBeLessThan(world.hexWidth * 0.6);
      expect((1 - b.t1) * b.length, b.id).toBeGreaterThan(0.2);
      // Walkable 1.4 m off the centre line at mid-span (the car fits side by side).
      const dx = b.b.x - b.a.x;
      const dz = b.b.z - b.a.z;
      const n = Math.hypot(dx, dz);
      const mx = (b.a.x + b.b.x) / 2 + (-dz / n) * 1.4;
      const mz = (b.a.z + b.b.z) / 2 + (dx / n) * 1.4;
      expect(surfaceAt(world.walk, mx, mz)?.bridgeId, b.id).toBe(b.id);
    }
  });

  it("covers all five home bridges in the real world", () => {
    for (const b of world.walk.bridges)
      expect(
        world.rails.filter((r) => r.kind === "bridge" && r.owner === b.id)
          .length,
        b.id
      ).toBeGreaterThan(4);
  });
});

describe("car spawn", () => {
  it("parks one car on a walkable home hex where it fits", () => {
    expect(world.vehicles).toHaveLength(1);
    const v = world.vehicles[0];
    expect(v?.islandId).toBe("home");
    if (!v) return;
    expect(carFits(world.carEnv, v.x, v.z, v.heading, v.y)).not.toBeNull();
    expect(
      world.interactables.some((i) => i.kind === "vehicle" && i.id === v.id)
    ).toBe(true);
  });

  it("validates vehicle entries", () => {
    const base = disc("a", 1, [0, 0]);
    expect(() =>
      parseIsland3D({ ...base, vehicles: [{ q: 0, r: 0 }] }, "x")
    ).toThrow(/vehicles\[0\] needs an id/);
    expect(
      islandProblems({ ...base, vehicles: [{ id: "car", q: 9, r: 9 }] })
    ).toContain("vehicle car is off the grid");
    expect(
      islandProblems({
        ...base,
        vehicles: [
          { id: "car", q: 0, r: 0 },
          { id: "car", q: 1, r: 0 },
        ],
      })
    ).toContain("duplicate vehicle car");
  });
});

describe("car controller", () => {
  const flat = buildWalkWorld([disc("a", 6, [0, 0])], []);
  const env = createCarEnv(flat, buildRails(flat), new Set());

  it("accelerates quickly to a top speed of about 16 m/s", () => {
    const s = createCarState(0, 0, -8, 0);
    let t = 0;
    while (s.speed < 12 && t < 5) {
      stepCar(env, s, GAS, DT);
      t += DT;
    }
    expect(t).toBeLessThan(1.6);
    const big = buildWalkWorld([disc("b", 30, [0, 0])], []);
    const benv = createCarEnv(big, [], new Set());
    const f = createCarState(0, 0, -40, 0);
    let top = 0;
    for (let i = 0; i < 240; i++) {
      stepCar(benv, f, GAS, DT);
      top = Math.max(top, f.speed);
    }
    expect(top).toBeGreaterThan(15);
    expect(top).toBeLessThanOrEqual(CAR.maxSpeed + 1e-6);
  });

  it("never leaves the island: the rim rails stop it", () => {
    const s = createCarState(0, 0, 0, 0);
    for (let i = 0; i < 400; i++) stepCar(env, s, GAS, DT);
    expect(canStand(flat, s.x, s.z, 0.3)).not.toBeNull();
    expect(Math.hypot(s.x, s.z)).toBeLessThan(6 * 2 + 0.2);
  });

  it("turns without drifting: velocity always follows the heading", () => {
    const s = createCarState(0, 0, -4, 0);
    for (let i = 0; i < 30; i++) stepCar(env, s, GAS, DT);
    const h0 = s.heading;
    const x0 = s.x;
    const z0 = s.z;
    stepCar(env, s, { throttle: 1, steer: 1, handbrake: false }, DT);
    const dir = Math.atan2(s.x - x0, s.z - z0);
    expect(Math.abs(dir - s.heading)).toBeLessThan(0.05);
    expect(s.heading).toBeLessThan(h0); // steering right turns clockwise from above
  });

  it("climbs a one-level (0.5 m) terrace step but not a 1 m cliff", () => {
    const island = disc("s", 4, [0, 0]);
    island.hexes = island.hexes.map((h) => ({
      ...h,
      h: h.r <= -2 ? (h.r <= -3 ? 2 : 1) : 0,
    }));
    const w = buildWalkWorld([island], []);
    const e = createCarEnv(w, buildRails(w), new Set());
    const s = createCarState(0, 0, 3, Math.PI);
    for (let i = 0; i < 240; i++) stepCar(e, s, GAS, DT);
    // Up two single-level (0.5 m) steps.
    expect(s.y).toBeGreaterThan(0.9);
    const cliff = disc("c", 4, [0, 0]);
    cliff.hexes = cliff.hexes.map((h) => ({ ...h, h: h.r <= -2 ? 2 : 0 }));
    const cw = buildWalkWorld([cliff], []);
    const ce = createCarEnv(cw, buildRails(cw), new Set());
    const c = createCarState(0, 0, 3, Math.PI);
    for (let i = 0; i < 240; i++) stepCar(ce, c, GAS, DT);
    expect(c.y).toBeLessThan(0.1);
  });

  it("crosses every bridge from the home island and back", () => {
    for (const b of world.walk.bridges) {
      const there = Math.atan2(b.b.x - b.a.x, b.b.z - b.a.z);
      const s = createCarState(b.a.x, b.a.y, b.a.z, there);
      let arrived = false;
      for (let i = 0; i < 240 && !arrived; i++) {
        stepCar(world.carEnv, s, GAS, DT);
        arrived = Math.hypot(s.x - b.b.x, s.z - b.b.z) < 1.6;
      }
      expect(arrived, `${b.id} out`).toBe(true);
      s.heading = there + Math.PI;
      s.speed = 0;
      let back = false;
      for (let i = 0; i < 240 && !back; i++) {
        stepCar(world.carEnv, s, GAS, DT);
        back = Math.hypot(s.x - b.a.x, s.z - b.a.z) < 1.6;
      }
      expect(back, `${b.id} back`).toBe(true);
    }
  });

  it("smashes a breakable prop at speed, and pushes through it from a standstill", () => {
    const island = disc("p", 6, [0, 0], {
      objects: [{ model: "tree-oak", q: 1, r: -2 }],
    });
    const w = buildWalkWorld([island], [], { manifest });
    const key = w.islands[0]?.obstacles[0]?.key ?? "";
    const e = createCarEnv(w, buildRails(w), new Set([key]));
    const fast = createCarState(0, 0, 3, Math.PI);
    const hits = [];
    for (let i = 0; i < 90; i++) hits.push(...stepCar(e, fast, GAS, DT).hits);
    expect(hits.map((o) => o.key)).toContain(key);

    // Parked nose against the tree: the first frames push (no bounce), then it breaks.
    const tree = w.islands[0]?.obstacles[0];
    const r = tree?.shape === "circle" ? tree.radius : 0.25;
    const touch = (tree?.z ?? 0) + CAR.offsets[2] + CAR.radius + r + 0.01;
    const slow = createCarState(0, 0, touch, Math.PI);
    const first = stepCar(e, slow, GAS, DT);
    expect(first.hits).toHaveLength(0);
    expect(first.bump).toBe(0);
    const broken = new Set<string>();
    w.broken = broken;
    let smashed = 0;
    for (let i = 0; i < 60; i++)
      for (const o of stepCar(e, slow, GAS, DT).hits) {
        smashed++;
        broken.add(o.key ?? "");
      }
    expect(smashed).toBe(1);
  });

  it("is stopped by an indestructible building", () => {
    const island = disc("h", 6, [0, 0], {
      objects: [{ model: "building-home-a-red", q: -2, r: 0 }],
    });
    const w = buildWalkWorld([island], [], { manifest });
    const e = createCarEnv(w, buildRails(w), new Set());
    // Head-on into the building's flat east face (pointy-top hexes face +-x with a side).
    const s = createCarState(4, 0, 0, -Math.PI / 2);
    let bump = 0;
    for (let i = 0; i < 120; i++)
      bump = Math.max(bump, stepCar(e, s, GAS, DT).bump);
    expect(s.x).toBeGreaterThan(-3 + CAR.length / 2 - 0.1);
    expect(bump).toBeGreaterThan(0);
  });
});

describe("exit spot", () => {
  const r = PLAYER_RADIUS_HEX * world.hexWidth;

  it("puts the driver beside the parked car on standable ground, clear of it", () => {
    const v = world.vehicles[0];
    if (!v) throw new Error("no car");
    const spot = findExitSpot(world.walk, v, r);
    expect(spot).not.toBeNull();
    if (!spot) return;
    expect(canStand(world.walk, spot.x, spot.z, r)).not.toBeNull();
    expect(distanceToCar(v, spot.x, spot.z)).toBeGreaterThanOrEqual(r);
    expect(Math.hypot(spot.x - v.x, spot.z - v.z)).toBeLessThan(2);
  });

  it("finds a spot in the middle of a bridge (in front or behind)", () => {
    const b = world.walk.bridges[0];
    if (!b) throw new Error("no bridge");
    const heading = Math.atan2(b.b.x - b.a.x, b.b.z - b.a.z);
    const car = {
      x: (b.a.x + b.b.x) / 2,
      y: (b.a.y + b.b.y) / 2,
      z: (b.a.z + b.b.z) / 2,
      heading,
    };
    const spot = findExitSpot(world.walk, car, r);
    expect(spot).not.toBeNull();
    if (spot) expect(distanceToCar(car, spot.x, spot.z)).toBeGreaterThan(r);
  });

  it("delays regrowth while the car or the player covers the spot", () => {
    const o = {
      shape: "circle" as const,
      x: 0,
      z: 0,
      radius: 0.3,
      source: "tree",
    };
    expect(spotOccupied(o, { x: 0.2, z: 0, heading: 0 }, null)).toBe(true);
    expect(spotOccupied(o, null, { x: 0.4, z: 0, radius: 0.4 })).toBe(true);
    expect(
      spotOccupied(o, { x: 5, z: 0, heading: 0 }, { x: 0, z: 3, radius: 0.4 })
    ).toBe(false);
  });
});
