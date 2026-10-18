/**
 * Island stories on the real islands: every mayor route waypoint and tour stop is walkable,
 * standable and reachable from the player spawn, pauses keep two hexes from the doors, each
 * tour leg has a path, and mayors with real testimonials only get narrator lines.
 */

import { describe, expect, it } from "vitest";

import { ISLANDS_3D } from "@/content/islands3d";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";
import { PROJECTS } from "@/lib/content/projects";
import { FORGE_RACK, STORY_LIST } from "@/lib/content/tours";
import { BRIDGES, ISLANDS } from "@/lib/content/world";
import { readModelBoundsFromDisk } from "../logic/bounds.node";
import { hexDistance } from "../logic/hex";
import { buildGameWorld, type MayorInfo } from "../logic/world-layout";
import {
  checkSpots,
  mayorObstacle,
  nearestIndex,
  nextRouteIndex,
  planMayorPath,
  spotToWorld,
  validateRoute,
  validateTour,
} from "./routes";

const manifest = readManifestFromDisk();
const mayors: Record<string, MayorInfo | undefined> = Object.fromEntries(
  ISLANDS.map((i) => [
    i.id,
    i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
  ])
);
const world = buildGameWorld(ISLANDS_3D, BRIDGES, mayors, manifest, {
  bounds: readModelBoundsFromDisk(ISLANDS_3D, manifest),
});

describe("island stories", () => {
  it("covers every project island, with its mayor's id", () => {
    expect(STORY_LIST.map((s) => s.islandId).sort()).toEqual(
      PROJECTS.map((p) => p.id).sort()
    );
    for (const s of STORY_LIST) {
      const island = ISLANDS.find((i) => i.id === s.islandId);
      expect(island?.mayor?.id).toBe(s.mayorId);
    }
  });

  it.each(STORY_LIST.map((s) => [s.islandId, s] as const))(
    "%s route waypoints are valid pause points",
    (_id, story) => {
      expect(validateRoute(world, story)).toEqual([]);
    }
  );

  it.each(STORY_LIST.map((s) => [s.islandId, s] as const))(
    "%s tour stops are reachable in order",
    (_id, story) => {
      expect(validateTour(world, story)).toEqual([]);
    }
  );

  it.each(STORY_LIST.map((s) => [s.islandId, s] as const))(
    "%s mayor can plan a path along the route (own collider ignored)",
    (_id, story) => {
      const self = mayorObstacle(world.walk, story.islandId, story.mayorId);
      expect(self).not.toBeNull();
      const island = ISLANDS_3D.find((i) => i.id === story.islandId);
      const spawn = island?.spawns?.mayor;
      const from = spawn && spotToWorld(world, story.islandId, spawn);
      expect(from).toBeTruthy();
      let at = from as NonNullable<typeof from>;
      for (const spot of [...story.route, ...story.tour.map((t) => t.stand)]) {
        const to = spotToWorld(world, story.islandId, spot);
        const path = to && planMayorPath(world, self, at, to);
        expect(path, `${spot.q},${spot.r}`).toBeTruthy();
        at = to as NonNullable<typeof to>;
      }
      expect(self?.radius).toBeGreaterThan(0);
    }
  );

  it("testimonial mayors only use narrator lines; demo lines only for demo mayors", () => {
    for (const s of STORY_LIST) {
      const mayor = ISLANDS.find((i) => i.id === s.islandId)?.mayor;
      for (const stop of s.tour) {
        if (mayor?.testimonialId) expect(stop.voice).toBe("narrator");
        if (stop.voice === "demo") expect(mayor?.demo).toBe(true);
      }
    }
  });

  it("each tour visits the project window and the portal", () => {
    for (const s of STORY_LIST) {
      const kinds = s.tour.map((t) => t.kind);
      expect(kinds).toContain("window");
      expect(kinds).toContain("portal");
    }
  });

  it("each project window sits on its island next to the portal", () => {
    for (const s of STORY_LIST) {
      const island = ISLANDS_3D.find((i) => i.id === s.islandId);
      const door = island?.doors?.find(
        (d) => d.buildingId === `portal_${s.islandId}`
      );
      expect(door).toBeTruthy();
      expect(spotToWorld(world, s.islandId, s.window.at)).toBeTruthy();
      expect(
        hexDistance(s.window.at, door as NonNullable<typeof door>)
      ).toBeLessThanOrEqual(2);
    }
  });

  it("the forge rack stands near the stack door on home", () => {
    const home = ISLANDS_3D.find((i) => i.id === FORGE_RACK.islandId);
    const door = home?.doors?.find(
      (d) => d.buildingId === FORGE_RACK.buildingId
    );
    expect(door).toBeTruthy();
    expect(spotToWorld(world, "home", FORGE_RACK.at)).toBeTruthy();
    expect(
      hexDistance(FORGE_RACK.at, door as NonNullable<typeof door>)
    ).toBeLessThanOrEqual(3);
  });
});

describe("route helpers", () => {
  it("flags a door hex and an unwalkable hex", () => {
    const s = STORY_LIST[0];
    if (!s) throw new Error("no stories");
    const island = ISLANDS_3D.find((i) => i.id === s.islandId);
    const door = island?.doors?.[0];
    if (!door) throw new Error("no door");
    const problems = checkSpots(
      world,
      s.islandId,
      s.mayorId,
      [
        { q: door.q, r: door.r },
        { q: 99, r: 99 },
      ],
      2
    );
    expect(problems.map((p) => p.reason)).toEqual(["door", "no-tile"]);
  });

  it("walks loops and ping-pongs", () => {
    const dir = { value: 1 as 1 | -1 };
    const seq = [0];
    for (let i = 0; i < 6; i++)
      seq.push(nextRouteIndex(seq.at(-1) ?? 0, dir, 3, "pingpong"));
    expect(seq).toEqual([0, 1, 2, 1, 0, 1, 2]);
    const loop = [0];
    for (let i = 0; i < 4; i++)
      loop.push(nextRouteIndex(loop.at(-1) ?? 0, dir, 3, "loop"));
    expect(loop).toEqual([0, 1, 2, 0, 1]);
  });

  it("finds the nearest waypoint", () => {
    const pts = [
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      { x: 0, y: 0, z: 9 },
    ];
    expect(nearestIndex(pts, 4, 1)).toBe(1);
    expect(nearestIndex(pts, 0, 7)).toBe(2);
  });
});
