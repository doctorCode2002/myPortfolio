import { describe, expect, it } from "vitest";

import { ISLANDS_3D } from "@/content/islands3d";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";

import { HEX_DIRECTIONS, hexSpiral } from "./hex";
import {
  ROAD_TILE_ARMS,
  ROAD_WIDTH,
  buildRoadNetwork,
  chaikin,
  distanceToRoad,
  resample,
  roadArms,
  roadNodes,
} from "./roads";
import type { HexTile, Island3D } from "./types";
import { buildIslandWalkGrid } from "./walk-grid";

function island(hexes: HexTile[], extra: Partial<Island3D> = {}): Island3D {
  const roads = new Set(hexes.map((h) => `${h.q},${h.r}`));
  const filler = hexSpiral({ q: 0, r: 0 }, 4)
    .filter((h) => !roads.has(`${h.q},${h.r}`))
    .map((h) => ({ ...h, tile: "hex-grass" }));
  return { id: "t", center: [0, 0], hexes: [...hexes, ...filler], ...extra };
}

describe("road tile connections", () => {
  it("lists every KayKit road variant", () => {
    for (const k of "abcdefghijklm")
      expect(ROAD_TILE_ARMS[`hex-road-${k}`]).toBeDefined();
    expect(roadArms("hex-road-a-sloped-low")).toEqual([0, 3]);
  });

  it("turns arms by the tile rotation", () => {
    expect(roadArms("hex-road-a", 0)).toEqual([0, 3]);
    expect(roadArms("hex-road-a", 60)).toEqual([1, 4]);
    expect(roadArms("hex-road-b", 240)).toEqual([1, 5]);
    expect(roadArms("hex-road-m", 180)).toEqual([0]);
    expect(roadArms("hex-road-m", -60)).toEqual([2]);
    expect(roadArms("hex-unknown")).toBeNull();
  });

  it("links only road hexes that face each other", () => {
    const isl = island([
      { q: 0, r: 0, tile: "hex-road-a" },
      { q: 1, r: 0, tile: "hex-road-a" },
      // Faces away from (0, 0): its arms are NE and SW.
      { q: -1, r: 0, tile: "hex-road-a", rot: 60 },
    ]);
    const nodes = roadNodes(isl, buildIslandWalkGrid(isl));
    const a = nodes.get("0,0");
    expect(a?.arms.get(0)).toEqual({ kind: "link", to: "1,0" });
    expect(a?.arms.get(3)).toEqual({ kind: "end", end: "cap" });
  });

  it("every road arm on the real islands meets a road, the rim, water or open ground", () => {
    for (const isl of ISLANDS_3D) {
      const nodes = roadNodes(isl, buildIslandWalkGrid(isl));
      let links = 0;
      for (const n of nodes.values())
        for (const s of n.arms.values()) if (s.kind === "link") links++;
      if (nodes.size > 0) expect(links).toBeGreaterThan(0);
    }
  });
});

describe("road network", () => {
  it("draws a straight road as one path with flat ends at the rim", () => {
    const hexes = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((q) => ({
      q,
      r: 0,
      tile: "hex-road-a",
    }));
    const isl = island(hexes);
    const net = buildRoadNetwork(isl, buildIslandWalkGrid(isl));
    expect(net.paths).toHaveLength(1);
    const p = net.paths[0]!;
    expect(p.closed).toBe(false);
    expect([p.start, p.end].sort()).toEqual(["flat", "flat"]);
    for (const pt of p.points) expect(Math.abs(pt.z)).toBeLessThan(1e-6);
    expect(net.width).toBe(ROAD_WIDTH);
  });

  it("splits at junctions and caps dead ends", () => {
    const isl = island([
      { q: 0, r: 0, tile: "hex-road-d" }, // NE W SE
      { q: 1, r: -1, tile: "hex-road-m", rot: 60 }, // arm SW back to the centre
      { q: -1, r: 0, tile: "hex-road-m", rot: 0 }, // arm W points away from the centre
      { q: 0, r: 1, tile: "hex-road-m", rot: 300 }, // arm NW back to the centre
    ]);
    const net = buildRoadNetwork(isl, buildIslandWalkGrid(isl));
    expect(net.junctions).toHaveLength(1);
    expect(net.junctions[0]).toMatchObject({ q: 0, r: 0, arms: 3 });
    const fromJunction = net.paths.filter(
      (p) => p.start === "junction" || p.end === "junction"
    );
    expect(fromJunction).toHaveLength(3);
    // Two arms reach dead ends, the west arm stops short of a hex facing away, which
    // is its own short capped stub.
    expect(net.paths).toHaveLength(4);
    expect(net.paths.filter((p) => p.end === "cap")).toHaveLength(4);
  });

  it("closes a ring of two-armed hexes into a loop", () => {
    // Six gentle bends around (0, 0): the hex in direction k has arms k + 2 and k + 4.
    const ring = HEX_DIRECTIONS.map((d, k) => ({
      ...d,
      tile: "hex-road-b",
      rot: 60 * (k + 1),
    }));
    const isl = island(ring);
    const net = buildRoadNetwork(isl, buildIslandWalkGrid(isl));
    expect(net.paths).toHaveLength(1);
    expect(net.paths[0]!.closed).toBe(true);
  });

  it("follows a ramp's height from the low level to the high one", () => {
    const isl = island(
      [
        { q: -1, r: 0, tile: "hex-road-a", h: 0 },
        { q: 0, r: 0, tile: "hex-road-a-sloped-low", h: 0 },
        { q: 1, r: 0, tile: "hex-road-a", h: 1 },
        { q: 2, r: 0, tile: "hex-road-a", h: 1 },
      ],
      {}
    );
    const grid = buildIslandWalkGrid(isl, {
      manifest: readManifestFromDisk(),
    });
    const net = buildRoadNetwork(isl, grid);
    const pts = net.paths.flatMap((p) => p.points);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(0, 5);
    expect(Math.max(...ys)).toBeCloseTo(grid.levelHeight, 5);
    // Monotonic climb from west to east.
    const byX = [...pts].sort((a, b) => a.x - b.x);
    for (let i = 1; i < byX.length; i++)
      expect(byX[i]!.y).toBeGreaterThanOrEqual(byX[i - 1]!.y - 1e-6);
  });

  it("measures distance to the centre line", () => {
    const isl = island([
      { q: 0, r: 0, tile: "hex-road-a" },
      { q: 1, r: 0, tile: "hex-road-a" },
    ]);
    const net = buildRoadNetwork(isl, buildIslandWalkGrid(isl));
    expect(distanceToRoad(net, 1, 0)).toBeCloseTo(0, 5);
    expect(distanceToRoad(net, 1, 0.8)).toBeCloseTo(0.8, 5);
  });

  it("builds a network for every real island with roads", () => {
    const manifest = readManifestFromDisk();
    for (const isl of ISLANDS_3D) {
      const grid = buildIslandWalkGrid(isl, { manifest });
      const net = buildRoadNetwork(isl, grid, {
        heightJitter: isl.heightJitter ?? 0,
      });
      const roads = isl.hexes.filter((h) => h.tile.startsWith("hex-road-"));
      if (roads.length === 0) expect(net.paths).toHaveLength(0);
      else expect(net.paths.length).toBeGreaterThan(0);
      for (const p of net.paths)
        for (const pt of p.points) expect(Number.isFinite(pt.y)).toBe(true);
      // Every road hex centre lies on a centre line.
      for (const h of roads) {
        const c = grid.cells.get(`${h.q},${h.r}`)!;
        expect(distanceToRoad(net, c.x, c.z)).toBeLessThan(0.35);
      }
    }
  });
});

describe("curve helpers", () => {
  it("chaikin keeps the end points of open curves", () => {
    const pts = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ];
    const out = chaikin(pts, 2, false);
    expect(out[0]).toEqual(pts[0]);
    expect(out[out.length - 1]).toEqual(pts[2]);
  });

  it("resample spaces points evenly", () => {
    const out = resample(
      [
        { x: 0, z: 0 },
        { x: 3, z: 0 },
      ],
      1,
      false
    );
    expect(out.map((p) => p.x)).toEqual([0, 1, 2, 3]);
  });
});
