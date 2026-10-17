import { existsSync } from "node:fs";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";

import { describe, expect, it } from "vitest";

import { ISLANDS_3D } from "@/content/islands3d";
import { BRIDGES, ISLANDS } from "@/lib/content/world";
import { moveCircle } from "./collision";
import { circumradiusFromWidth, hexSpiral } from "./hex";
import {
  buildNavGraph,
  cellNodeId,
  checkIslandReachability,
  findNodePath,
  findPath,
  raycastWalk,
  reachableFrom,
} from "./pathfinding";
import type { Island3D, Manifest } from "./types";
import { islandProblems } from "./validate-island";
import { buildWalkWorld } from "./walk-world";
import {
  buildGameWorld,
  nearestInteractable,
  spawnPoint,
  type MayorInfo,
} from "./world-layout";

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

describe("nav graph, BFS and A*", () => {
  it("connects all hexes of an open island", () => {
    const w = buildWalkWorld([disc("a", 3, [0, 0])], []);
    const g = buildNavGraph(w);
    expect(reachableFrom(g, cellNodeId("a", 0, 0)).size).toBe(37);
  });

  it("cuts off hexes behind a wall of water", () => {
    const island = disc("a", 2, [0, 0]);
    // Ring 1 is water: the centre is cut off from ring 2.
    island.hexes = island.hexes.map((h) =>
      Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) === 1
        ? { ...h, tile: "hex-water" }
        : h
    );
    const w = buildWalkWorld([island], []);
    const g = buildNavGraph(w);
    expect(reachableFrom(g, cellNodeId("a", 0, 0)).size).toBe(1);
    expect(
      findNodePath(g, cellNodeId("a", 0, 0), cellNodeId("a", 2, 0))
    ).toBeNull();
    const report = checkIslandReachability(w, {
      ...island,
      doors: [{ buildingId: "x", q: 2, r: -2 }],
    });
    expect(report.ok).toBe(false);
    expect(report.unreachable.map((u) => u.id)).toEqual(["x"]);
  });

  it("routes around a building and string-pulls a straight line where possible", () => {
    const island = disc("a", 3, [0, 0], {
      objects: [{ model: "building-hall", q: 0, r: 0 }],
    });
    const w = buildWalkWorld([island], []);
    const g = buildNavGraph(w);
    const from = { x: -4, y: 0, z: 0 };
    const path = findPath(w, g, from, { x: 4, z: 0 }, 0.4);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
    // Following the waypoints with the collider reaches the goal.
    let body = { ...from };
    for (const wp of path!) {
      for (let i = 0; i < 200; i++) {
        const dx = wp.x - body.x;
        const dz = wp.z - body.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.05) break;
        const step = Math.min(0.1, d);
        body = moveCircle(w, body, (dx / d) * step, (dz / d) * step, 0.4);
      }
    }
    expect(Math.hypot(body.x - 4, body.z)).toBeLessThan(0.2);
    const straight = findPath(
      w,
      g,
      { x: -1.5, y: 0, z: 2.5 },
      { x: 1.5, z: 2.5 },
      0.4
    );
    expect(straight).toHaveLength(1);
  });

  it("paths across bridges between islands", () => {
    const a = disc("a", 2, [0, 0], { anchors: [{ id: "to_b", q: 0, r: -2 }] });
    const b = disc("b", 2, [0, -20], { anchors: [{ id: "to_a", q: 0, r: 2 }] });
    const w = buildWalkWorld([a, b], [{ from: "a", to: "b" }]);
    const g = buildNavGraph(w);
    expect(
      findNodePath(g, cellNodeId("a", 0, 0), cellNodeId("b", 0, 0))
    ).not.toBeNull();
    expect(
      findPath(w, g, { x: 0, y: 0, z: 0 }, { x: 0, z: -20 }, 0.4)
    ).not.toBeNull();
  });

  it("ray-picks the ground under a downward ray and misses over the void", () => {
    const w = buildWalkWorld([disc("a", 2, [0, 0], { baseY: 1 })], []);
    const hit = raycastWalk(w, { x: 0, y: 10, z: 10 }, { x: 0, y: -1, z: -1 });
    expect(hit?.y).toBe(1);
    expect(hit?.z).toBeCloseTo(1, 0);
    expect(
      raycastWalk(w, { x: 30, y: 10, z: 0 }, { x: 0, y: -1, z: 0 })
    ).toBeNull();
  });

  it("keeps R consistent with the 2 m tile", () => {
    expect(R * Math.sqrt(3)).toBeCloseTo(2);
  });
});

describe("starter content (content/islands3d)", () => {
  const mayors: Record<string, MayorInfo | undefined> = Object.fromEntries(
    ISLANDS.map((i) => [
      i.id,
      i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
    ])
  );
  const world = buildGameWorld(
    ISLANDS_3D,
    BRIDGES,
    mayors,
    readManifestFromDisk()
  );

  it("has no content problems and uses ids from lib/content/world.ts", () => {
    const known = new Set(ISLANDS.flatMap((i) => i.buildings.map((b) => b.id)));
    for (const island of ISLANDS_3D) {
      expect(islandProblems(island)).toEqual([]);
      for (const d of island.doors ?? [])
        expect(known.has(d.buildingId)).toBe(true);
    }
    const home = ISLANDS_3D.find((i) => i.id === "home");
    expect(home?.doors?.map((d) => d.buildingId).sort()).toEqual(
      ISLANDS.find((i) => i.id === "home")!
        .buildings.map((b) => b.id)
        .sort()
    );
  });

  it("reaches every door, mayor and anchor from each spawn", () => {
    for (const island of ISLANDS_3D) {
      const report = checkIslandReachability(world.walk, island);
      expect(report.unreachable, island.id).toEqual([]);
    }
  });

  it("joins home and khidmty with a bridge the player can path across", () => {
    expect(world.walk.bridges.map((b) => b.id)).toContain("home-khidmty");
    const from = spawnPoint(world, "home");
    const to = spawnPoint(world, "khidmty");
    expect(findPath(world.walk, world.nav, from, to, 0.4)).not.toBeNull();
  });

  it("exposes doors and the khidmty mayor as interactables in range at their hex", () => {
    const door = world.interactables.find(
      (i) => i.id === "building_education"
    )!;
    expect(
      nearestInteractable(world.interactables, door.x, door.y, door.z)?.item.id
    ).toBe("building_education");
    const mayor = world.interactables.find((i) => i.kind === "npc");
    expect(mayor?.id).toBe("mayor_khidmty");
    expect(mayor?.charSheet).toBe("char_3");
  });
});

describe("starter content with the real manifest (when present)", () => {
  const path = "public/game3d/models/manifest.json";
  const manifest: Manifest | null = existsSync(path)
    ? readManifestFromDisk()
    : null;
  const mayors: Record<string, MayorInfo | undefined> = Object.fromEntries(
    ISLANDS.map((i) => [
      i.id,
      i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
    ])
  );

  it.runIf(manifest)(
    "uses no banned or unknown models and stays reachable with measured collisions",
    () => {
      for (const island of ISLANDS_3D) {
        for (const name of [
          ...island.hexes.map((h) => h.tile),
          ...(island.objects ?? []).map((o) => o.model),
        ]) {
          expect(manifest!.models[name], name).toBeDefined();
          expect(manifest!.models[name]?.banned, name).toBeFalsy();
        }
      }
      const world = buildGameWorld(ISLANDS_3D, BRIDGES, mayors, manifest);
      for (const island of ISLANDS_3D) {
        expect(
          checkIslandReachability(world.walk, island).unreachable,
          island.id
        ).toEqual([]);
      }
    }
  );
});
