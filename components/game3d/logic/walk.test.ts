import { describe, expect, it } from "vitest";

import { canStand, moveCircle, nearestStandable } from "./collision";
import { hexSpiral, hexToWorld, circumradiusFromWidth } from "./hex";
import type { Island3D } from "./types";
import {
  buildIslandWalkGrid,
  cellAtWorld,
  edgeCells,
  isCellWalkable,
  obstacleDistance,
} from "./walk-grid";
import { bridgeHeightAt, buildWalkWorld, surfaceAt } from "./walk-world";

const R = circumradiusFromWidth(2);

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

describe("island walk grid", () => {
  it("marks grass walkable, water not, and building hexes blocked", () => {
    const island = disc("a", 2, [0, 0]);
    island.hexes = island.hexes.map((h) =>
      h.q === 1 && h.r === 0 ? { ...h, tile: "hex-water" } : h
    );
    island.objects = [{ model: "building-house", q: -1, r: 0 }];
    const grid = buildIslandWalkGrid(island);
    expect(isCellWalkable(grid.cells.get("0,0"))).toBe(true);
    expect(isCellWalkable(grid.cells.get("1,0"))).toBe(false);
    expect(grid.cells.get("1,0")?.water).toBe(true);
    expect(grid.cells.get("-1,0")?.blocked).toBe(true);
  });

  it("turns trees and rocks into circle obstacles at their world position", () => {
    const island = disc("a", 1, [10, 5], {
      objects: [{ model: "tree-a", q: 1, r: 0, offset: [0.2, 0] }],
    });
    const grid = buildIslandWalkGrid(island);
    expect(grid.obstacles).toHaveLength(1);
    const p = hexToWorld(1, 0, R);
    expect(grid.obstacles[0]?.x).toBeCloseTo(10 + p.x + 0.2);
    expect(grid.obstacles[0]?.z).toBeCloseTo(5 + p.z);
  });

  it("applies heights per level and finds cells from world points", () => {
    const island = disc("a", 1, [0, 0], { baseY: 2 });
    island.hexes = island.hexes.map((h) =>
      h.q === 0 && h.r === 0 ? { ...h, h: 2 } : h
    );
    const grid = buildIslandWalkGrid(island, { levelHeight: 0.5 });
    expect(cellAtWorld(grid, 0.1, 0.1)?.y).toBeCloseTo(3);
    expect(cellAtWorld(grid, 50, 50)).toBeUndefined();
  });

  it("finds the outer ring as edge cells", () => {
    const grid = buildIslandWalkGrid(disc("a", 2, [0, 0]));
    expect(edgeCells(grid)).toHaveLength(12);
  });
});

describe("walk world and bridges", () => {
  const a = disc("a", 2, [0, 0], { anchors: [{ id: "to_b", q: 0, r: -2 }] });
  const b = disc("b", 2, [0, -20], {
    baseY: 1,
    anchors: [{ id: "to_a", q: 0, r: 2 }],
  });
  const world = buildWalkWorld(
    [a, b],
    [{ from: "a", to: "b", style: "stone" }]
  );

  it("joins anchors with a corridor and interpolates the deck height", () => {
    expect(world.bridges).toHaveLength(1);
    const br = world.bridges[0]!;
    expect(br.a.y).toBe(0);
    expect(br.b.y).toBe(1);
    expect(bridgeHeightAt(br, 0)).toBeCloseTo(0);
    expect(bridgeHeightAt(br, 1)).toBeCloseTo(1);
    expect(bridgeHeightAt(br, 0.5)).toBeGreaterThan(0.5);
    const mid = surfaceAt(world, (br.a.x + br.b.x) / 2, (br.a.z + br.b.z) / 2);
    expect(mid?.bridgeId).toBe(br.id);
  });

  it("returns null over the void beside the bridge", () => {
    const br = world.bridges[0]!;
    expect(
      surfaceAt(world, (br.a.x + br.b.x) / 2 + 3, (br.a.z + br.b.z) / 2)
    ).toBeNull();
  });

  it("falls back to the nearest edge hex when an anchor is missing", () => {
    const w = buildWalkWorld(
      [disc("a", 2, [0, 0]), disc("b", 2, [0, -20])],
      [{ from: "a", to: "b" }]
    );
    expect(w.bridges[0]?.fromCell.r).toBe(-2);
    expect(w.bridges[0]?.toCell.r).toBe(2);
  });
});

describe("circle collider movement", () => {
  const island = disc("a", 2, [0, 0], {
    objects: [{ model: "rock-big", q: 1, r: 0 }],
  });
  const world = buildWalkWorld([island], []);
  const radius = 0.4;

  it("moves freely on open ground", () => {
    const res = moveCircle(world, { x: 0, y: 0, z: 0 }, 0, -1, radius);
    expect(res.blocked).toBe(false);
    expect(res.z).toBeCloseTo(-1);
  });

  it("stops at the island edge (never walks into the void)", () => {
    let body = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 100; i++)
      body = moveCircle(world, body, -0.2, 0, radius);
    expect(canStand(world, body.x, body.z, radius)).not.toBeNull();
    expect(body.x).toBeLessThan(-3);
    expect(body.x).toBeGreaterThan(-6);
  });

  it("slides along an obstacle instead of sticking", () => {
    const rock = world.islands[0]!.obstacles[0]!;
    // Push diagonally into the rock: the body keeps making progress past it.
    let body = { x: rock.x - 1.2, y: 0, z: rock.z + 0.1 };
    const startZ = body.z;
    for (let i = 0; i < 30; i++)
      body = moveCircle(world, body, 0.1, 0.05, radius);
    expect(obstacleDistance(rock, body.x, body.z)).toBeGreaterThanOrEqual(
      radius - 1e-6
    );
    expect(body.z).toBeGreaterThan(startZ + 0.5);
  });

  it("refuses steps of two levels but climbs one", () => {
    const steps = disc("s", 2, [0, 0]);
    steps.hexes = steps.hexes.map((h) =>
      h.q === 1 && h.r === 0
        ? { ...h, h: 1 }
        : h.q === -1 && h.r === 0
          ? { ...h, h: 2 }
          : h
    );
    const w = buildWalkWorld([steps], [], { levelHeight: 0.5 });
    let east = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 20; i++) east = moveCircle(w, east, 0.1, 0, 0.3);
    expect(east.y).toBeCloseTo(0.5);
    let west = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 20; i++) west = moveCircle(w, west, -0.1, 0, 0.3);
    expect(west.y).toBeCloseTo(0);
    expect(west.x).toBeGreaterThan(-1.2);
  });

  it("walks across a bridge from one island to the other", () => {
    const a = disc("a", 2, [0, 0], { anchors: [{ id: "to_b", q: 0, r: -2 }] });
    const b = disc("b", 2, [0, -20], {
      baseY: 0.5,
      anchors: [{ id: "to_a", q: 0, r: 2 }],
    });
    const w = buildWalkWorld([a, b], [{ from: "a", to: "b", style: "rope" }]);
    const br = w.bridges[0]!;
    let body = { x: br.a.x, y: 0, z: br.a.z };
    for (let i = 0; i < 200; i++) {
      const dx = br.b.x - body.x;
      const dz = br.b.z - body.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.1) break;
      body = moveCircle(w, body, (dx / d) * 0.15, (dz / d) * 0.15, 0.4);
    }
    expect(Math.hypot(body.x - br.b.x, body.z - br.b.z)).toBeLessThan(0.2);
    expect(body.y).toBeCloseTo(0.5);
  });

  it("blocks against an oriented box (a rotated building)", () => {
    const isl = disc("b", 3, [0, 0], {
      objects: [{ model: "building-house", q: 0, r: 0, rot: 30 }],
    });
    const w = buildWalkWorld([isl], []);
    const box = w.islands[0]!.obstacles[0]!;
    expect(box.shape).toBe("box");
    expect(obstacleDistance(box, 0, 0)).toBeLessThan(0);
    let body = { x: -4, y: 0, z: 0 };
    for (let i = 0; i < 60; i++) body = moveCircle(w, body, 0.1, 0, radius);
    expect(obstacleDistance(box, body.x, body.z)).toBeGreaterThanOrEqual(
      radius - 1e-6
    );
  });

  it("recovers a standable point near a blocked one", () => {
    const rock = world.islands[0]!.obstacles[0]!;
    const p = nearestStandable(world, rock.x, rock.z, radius);
    expect(p).not.toBeNull();
  });
});
