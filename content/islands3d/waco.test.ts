/**
 * The WACO island (an industrial and engineering consultancy in Riyadh): parses cleanly,
 * uses only known, unbanned models, reaches the HQ door, the mayor (Wejdan Abdulhadi,
 * narration only) and the anchor with the real model bounds, joins home's north-west rim
 * by a 9 m bridge, keeps every island pair at least 8.9 m apart, and is in PROJECTS with
 * English and Arabic text.
 */

import { describe, expect, it } from "vitest";

import { readModelBoundsFromDisk } from "@/components/game3d/logic/bounds.node";
import { hexKey, hexNeighbours } from "@/components/game3d/logic/hex";
import {
  cellNodeId,
  checkIslandReachability,
  findNodePath,
  findPath,
  lineWalkable,
} from "@/components/game3d/logic/pathfinding";
import {
  islandProblems,
  parseIsland3D,
} from "@/components/game3d/logic/validate-island";
import { islandHexToWorld } from "@/components/game3d/logic/walk-grid";
import { BRIDGE_WIDTH_HEX } from "@/components/game3d/logic/walk-world";
import {
  buildGameWorld,
  PLAYER_RADIUS_HEX,
  spawnPoint,
  type MayorInfo,
} from "@/components/game3d/logic/world-layout";
import ar from "@/app/dictionaries/ar.json";
import en from "@/app/dictionaries/en.json";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";
import { PROJECTS } from "@/lib/content/projects";
import { storyForIsland } from "@/lib/content/tours";
import { BRIDGES, ISLANDS } from "@/lib/content/world";

import homeJson from "./home.json";
import { ISLANDS_3D } from "./index";
import wacoJson from "./waco.json";

const manifest = readManifestFromDisk();
const size = 2 / Math.sqrt(3);
const island = parseIsland3D(wacoJson, "waco.json");
const home = parseIsland3D(homeJson, "home.json");

const mayors: Record<string, MayorInfo | undefined> = Object.fromEntries(
  ISLANDS.map((i) => [
    i.id,
    i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
  ])
);

describe("waco island", () => {
  it("parses cleanly as a desert island in the north-west gap", () => {
    expect(island.id).toBe("waco");
    expect(islandProblems(island)).toEqual([]);
    expect(island.placeholder).toBeFalsy();
    expect(island.biome).toBe("desert");
    expect(island.underside?.style).toBe("sand");
    expect(island.center[0]).toBeLessThan(-10);
    expect(island.center[1]).toBeLessThan(-15);
    for (const h of island.hexes) {
      const p = islandHexToWorld(island, h.q, h.r, size);
      const d = Math.hypot(p.x - island.center[0], p.z - island.center[1]);
      expect(d + size, hexKey(h.q, h.r)).toBeLessThanOrEqual(11.2);
    }
  });

  it("uses only known, unbanned models, and its own models are lazy", () => {
    const names = [
      ...island.hexes.map((h) => h.tile),
      ...(island.objects ?? []).map((o) => o.model),
    ];
    const bad = names.filter(
      (n) => !manifest.models[n] || manifest.models[n]?.banned
    );
    expect(bad).toEqual([]);
    const own = names.filter((n) => n.startsWith("w-"));
    expect(own.length).toBeGreaterThan(10);
    for (const n of own) expect(manifest.models[n]?.lazy, n).toBe(true);
    expect(names).toContain("w-hq");
  });

  it("has the HQ portal door, the mayor and a to_home anchor on the rim", () => {
    expect(island.doors?.map((d) => d.buildingId)).toEqual(["portal_waco"]);
    expect(island.spawns?.mayor).toBeDefined();
    const keys = new Set(island.hexes.map((h) => hexKey(h.q, h.r)));
    const anchor = island.anchors?.find((a) => a.id === "to_home");
    expect(anchor).toBeDefined();
    expect(
      hexNeighbours(anchor!.q, anchor!.r).some(
        (n) => !keys.has(hexKey(n.q, n.r))
      )
    ).toBe(true);
  });

  it("reaches the door, the mayor and the anchor with measured collisions", () => {
    const world = buildGameWorld([island], [], mayors, manifest, {
      bounds: readModelBoundsFromDisk([island], manifest),
    });
    expect(checkIslandReachability(world.walk, island).unreachable).toEqual([]);
    expect(world.interactables.map((i) => i.id).sort()).toEqual(
      ["mayor_waco", "portal_waco"].sort()
    );
    const radius = PLAYER_RADIUS_HEX * world.hexWidth;
    const spawn = island.spawns!.player!;
    const start = cellNodeId("waco", spawn.q, spawn.r);
    expect(world.nav.nodes.has(start), "spawn hex is open").toBe(true);
    for (const goal of [
      ...(island.doors ?? []),
      ...(island.anchors ?? []),
      island.spawns!.mayor!,
    ]) {
      const path = [{ q: goal.q, r: goal.r }, ...hexNeighbours(goal.q, goal.r)]
        .map((h) => cellNodeId("waco", h.q, h.r))
        .filter((n) => world.nav.nodes.has(n))
        .map((c) => findNodePath(world.nav, start, c))
        .find((p) => p !== null);
      expect(path, `${goal.q},${goal.r}`).toBeTruthy();
      for (let i = 1; i < path!.length; i++) {
        const a = world.nav.nodes.get(path![i - 1]!)!;
        const b = world.nav.nodes.get(path![i]!)!;
        expect(
          lineWalkable(world.walk, a, b, radius),
          `${a.id} -> ${b.id}`
        ).toBe(true);
      }
    }
  });

  it("is joined to home's north-west rim by a 9 m bridge, walkable from home", () => {
    const links = BRIDGES.filter((b) => b.from === "home" && b.to === "waco");
    expect(links).toHaveLength(1);
    const world = buildGameWorld([home, island], links, mayors, manifest, {
      bounds: readModelBoundsFromDisk([home, island], manifest),
    });
    const bridge = world.walk.bridges[0];
    expect(bridge).toBeDefined();
    const a = home.anchors!.find((x) => x.id === "to_waco")!;
    const b = island.anchors!.find((x) => x.id === "to_home")!;
    expect(bridge!.fromCell).toEqual({ q: a.q, r: a.r });
    expect(bridge!.toCell).toEqual({ q: b.q, r: b.r });
    expect(bridge!.length).toBeCloseTo(9, 1);
    expect(bridge!.halfWidth).toBeCloseTo(
      (world.hexWidth * BRIDGE_WIDTH_HEX) / 2 - 0.05,
      5
    );
    const homeKeys = new Set(home.hexes.map((h) => hexKey(h.q, h.r)));
    expect(
      hexNeighbours(a.q, a.r).some((n) => !homeKeys.has(hexKey(n.q, n.r))),
      "home anchor on the rim"
    ).toBe(true);
    const path = findPath(
      world.walk,
      world.nav,
      spawnPoint(world, "home"),
      spawnPoint(world, "waco"),
      0.4
    );
    expect(path).not.toBeNull();
  });

  it("keeps every home bridge about 9 m long", () => {
    const links = BRIDGES.filter((b) => b.from === "home");
    const world = buildGameWorld(ISLANDS_3D, links, mayors, manifest, {
      bounds: readModelBoundsFromDisk(ISLANDS_3D, manifest),
    });
    expect(world.walk.bridges).toHaveLength(links.length);
    for (const b of world.walk.bridges)
      expect(b.length, b.id).toBeCloseTo(9, 1);
  });

  it("keeps every island at least 8.9 m from every other", () => {
    expect(ISLANDS_3D.map((i) => i.id)).toContain("waco");
    const pts = ISLANDS_3D.map((isl) => ({
      id: isl.id,
      p: isl.hexes.map((h) => islandHexToWorld(isl, h.q, h.r, size)),
    }));
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        let best = Infinity;
        for (const a of pts[i]!.p)
          for (const b of pts[j]!.p)
            best = Math.min(best, Math.hypot(a.x - b.x, a.z - b.z));
        expect(best, `${pts[i]!.id} - ${pts[j]!.id}`).toBeGreaterThanOrEqual(
          8.9
        );
      }
  });

  it("has Wejdan as a real, narration-only mayor with a tour and project window", () => {
    const world = ISLANDS.find((i) => i.id === "waco");
    expect(world?.mayor?.id).toBe("mayor_waco");
    expect(world?.mayor?.real).toBe(true);
    expect(world?.mayor?.demo).toBeFalsy();
    expect(world?.buildings.map((b) => b.id)).toEqual(["portal_waco"]);
    const story = storyForIsland("waco");
    expect(story?.mayorId).toBe("mayor_waco");
    expect(story?.tour.every((t) => t.voice === "narrator")).toBe(true);
    for (const dict of [en, ar]) {
      const m = dict.world.mayors.mayor_waco;
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.title.length).toBeGreaterThan(0);
      // Narration about her, never words in her mouth.
      for (const line of m.lines)
        expect(line).toMatch(/^(Narrator: |الراوي: )/);
      for (const stop of story!.tour) {
        const tours = dict.world.tours as unknown as Record<
          string,
          Record<string, string>
        >;
        expect(tours.waco?.[stop.id]?.length, stop.id).toBeGreaterThan(0);
      }
      expect(dict.world.islands.waco.name.length).toBeGreaterThan(0);
      expect(dict.world.buildings.portal_waco.sign.length).toBeGreaterThan(0);
    }
  });

  it("is in PROJECTS with its live site, image and en/ar text", () => {
    const p = PROJECTS.find((x) => x.id === "waco");
    expect(p).toBeDefined();
    expect(p?.href).toBe("https://waco.sa");
    expect(p?.image).toBe("/assets/projects/waco.webp");
    expect(p?.year).toBe("2026");
    expect(p?.frameworks).toEqual(["Next.js", "Laravel", "Filament"]);
    for (const dict of [en, ar]) {
      const item = dict.projects.items.waco;
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(40);
    }
  });
});
