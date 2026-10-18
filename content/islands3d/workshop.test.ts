/**
 * The workshop island ("Under construction", world v2): the lots fill from
 * lib/content/in-progress.ts, every door, the foreman and the anchor are reachable with
 * the real model bounds, the bridge from home attaches 9 m long, and the islands keep
 * their spacing after home grew.
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
import {
  IN_PROGRESS,
  WORKSHOP_LOTS,
  type InProgressProject,
} from "@/lib/content/in-progress";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";
import { BRIDGES, ISLANDS } from "@/lib/content/world";
import { getBuildingPanel } from "@/lib/content/world.panels";

import homeJson from "./home.json";
import { ISLANDS_3D, WORKSHOP } from "./index";
import {
  buildWorkshopIsland,
  MAX_WORKERS,
  STAGE_MODEL,
  type WorkshopSource,
} from "./workshop";
import workshopJson from "./workshop.json";

const manifest = readManifestFromDisk();
const size = 2 / Math.sqrt(3);
const source = parseIsland3D(workshopJson, "workshop.json") as WorkshopSource;
const home = parseIsland3D(homeJson, "home.json");

const mayors: Record<string, MayorInfo | undefined> = Object.fromEntries(
  ISLANDS.map((i) => [
    i.id,
    i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
  ])
);

function demo(n: number): InProgressProject[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `test_${i + 1}`,
    name: { en: `Test ${i + 1}`, ar: `اختبار ${i + 1}` },
    pitch: { en: "Pitch", ar: "وصف" },
    progress: (i * 23) % 100,
    status: "building" as const,
  }));
}

function modelsOf(island: {
  hexes: { tile: string }[];
  objects?: { model: string }[];
}): string[] {
  return [
    ...island.hexes.map((h) => h.tile),
    ...(island.objects ?? []).map((o) => o.model),
  ];
}

describe("workshop island", () => {
  const { island } = WORKSHOP;

  it("parses cleanly with six lots and no content problems", () => {
    expect(island.id).toBe("workshop");
    expect(islandProblems(island)).toEqual([]);
    expect(source.lots?.map((l) => l.lot)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(WORKSHOP_LOTS).toBe(6);
  });

  it("uses only known, unbanned models (every stage, plot and worker too)", () => {
    const names = [
      ...modelsOf(island),
      ...modelsOf(buildWorkshopIsland(source, []).island),
      ...Object.values(STAGE_MODEL),
      ...WORKSHOP.workers.map((w) => w.model),
      "v2-crane-jib",
      "v2-crane-load",
    ];
    const bad = names.filter(
      (n) => !manifest.models[n] || manifest.models[n]?.banned
    );
    expect(bad).toEqual([]);
    for (const w of WORKSHOP.workers)
      expect(manifest.models[w.model]?.animations, w.model).toContain(w.clip);
  });

  it("fills one lot per in-progress project, in order, and leaves the rest as plots", () => {
    expect(WORKSHOP.placements.map((p) => p.lot)).toEqual(
      IN_PROGRESS.slice(0, WORKSHOP_LOTS).map((_, i) => i + 1)
    );
    const plots = island.objects?.filter((o) => o.model === "v2-empty-plot");
    expect(plots).toHaveLength(WORKSHOP_LOTS - WORKSHOP.placements.length);
    const world = ISLANDS.find((i) => i.id === "workshop");
    expect(world?.buildings.map((b) => b.id)).toEqual(
      WORKSHOP.placements.map((p) => p.buildingId)
    );
    expect(island.doors?.map((d) => d.buildingId)).toEqual(
      WORKSHOP.placements.map((p) => p.buildingId)
    );
    expect(WORKSHOP.workers.length).toBeGreaterThanOrEqual(
      Math.min(2, WORKSHOP.placements.length)
    );
    expect(WORKSHOP.workers.length).toBeLessThanOrEqual(MAX_WORKERS);
  });

  it("adding a 4th in-progress project builds a 4th house on lot 4", () => {
    const three = buildWorkshopIsland(source, demo(3));
    const four = buildWorkshopIsland(source, demo(4));
    expect(three.placements).toHaveLength(3);
    expect(four.placements).toHaveLength(4);
    const lot4 = source.lots!.find((l) => l.lot === 4)!;
    expect(four.placements[3]).toEqual({
      lot: 4,
      projectId: "test_4",
      buildingId: "progress_test_4",
    });
    const houses = new Set(Object.values(STAGE_MODEL));
    const onLot4 = (r: typeof four) =>
      r.island.objects!.filter((o) => o.q === lot4.q && o.r === lot4.r);
    expect(onLot4(three).some((o) => o.model === "v2-empty-plot")).toBe(true);
    expect(onLot4(four).some((o) => houses.has(o.model))).toBe(true);
    expect(onLot4(four).some((o) => o.model === "v2-empty-plot")).toBe(false);
    expect(four.island.doors?.at(-1)).toMatchObject({
      buildingId: "progress_test_4",
      q: lot4.door.q,
      r: lot4.door.r,
    });
    // More projects than lots: only the first six get one.
    expect(buildWorkshopIsland(source, demo(8)).placements).toHaveLength(6);
  });

  it.each([0, 3, 6])(
    "reaches every door, the foreman and the anchor with %i projects (real bounds)",
    (n) => {
      const isl =
        n === 3 ? island : buildWorkshopIsland(source, demo(n)).island;
      const world = buildGameWorld([isl], [], mayors, manifest, {
        bounds: readModelBoundsFromDisk([isl], manifest),
      });
      expect(checkIslandReachability(world.walk, isl).unreachable).toEqual([]);
      const radius = PLAYER_RADIUS_HEX * world.hexWidth;
      const spawn = isl.spawns!.player!;
      const start = cellNodeId("workshop", spawn.q, spawn.r);
      expect(world.nav.nodes.has(start), "spawn hex is open").toBe(true);
      for (const goal of [
        ...(isl.doors ?? []),
        ...(isl.anchors ?? []),
        isl.spawns!.mayor!,
      ]) {
        const path = [
          { q: goal.q, r: goal.r },
          ...hexNeighbours(goal.q, goal.r),
        ]
          .map((h) => cellNodeId("workshop", h.q, h.r))
          .filter((c) => world.nav.nodes.has(c))
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
    }
  );

  it("has the foreman and every project door as interactables", () => {
    const world = buildGameWorld([island], [], mayors, manifest, {
      bounds: readModelBoundsFromDisk([island], manifest),
    });
    expect(world.interactables.map((i) => i.id).sort()).toEqual(
      [...WORKSHOP.placements.map((p) => p.buildingId), "mayor_workshop"].sort()
    );
  });

  it("is joined to home by a 9 m bridge of the wide deck, walkable from home", () => {
    const links = BRIDGES.filter(
      (b) => b.from === "home" && b.to === "workshop"
    );
    expect(links).toHaveLength(1);
    const world = buildGameWorld([home, island], links, mayors, manifest, {
      bounds: readModelBoundsFromDisk([home, island], manifest),
    });
    const bridge = world.walk.bridges[0];
    expect(bridge).toBeDefined();
    const a = home.anchors!.find((x) => x.id === "to_workshop")!;
    const b = island.anchors!.find((x) => x.id === "to_home")!;
    expect(bridge!.fromCell).toEqual({ q: a.q, r: a.r });
    expect(bridge!.toCell).toEqual({ q: b.q, r: b.r });
    expect(bridge!.length).toBeCloseTo(9, 1);
    expect(bridge!.halfWidth).toBeCloseTo(
      (world.hexWidth * BRIDGE_WIDTH_HEX) / 2 - 0.05,
      5
    );
    for (const [isl, anchor] of [
      [home, a],
      [island, b],
    ] as const) {
      const keys = new Set(isl.hexes.map((h) => hexKey(h.q, h.r)));
      expect(
        hexNeighbours(anchor.q, anchor.r).some(
          (n) => !keys.has(hexKey(n.q, n.r))
        ),
        `${isl.id} anchor on the rim`
      ).toBe(true);
    }
    const path = findPath(
      world.walk,
      world.nav,
      spawnPoint(world, "home"),
      spawnPoint(world, "workshop"),
      0.4
    );
    expect(path).not.toBeNull();
  });

  it("keeps every island at least ~9 m from every other (home grew)", () => {
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

  it("resolves a progress panel for every project in English and Arabic", () => {
    for (const p of WORKSHOP.placements)
      for (const lang of ["en", "ar"]) {
        const panel = getBuildingPanel(p.buildingId, lang);
        expect(panel?.kind).toBe("progress");
        if (panel?.kind !== "progress") continue;
        const src = IN_PROGRESS.find((x) => x.id === p.projectId)!;
        expect(panel.project.progress).toBe(src.progress);
        expect(panel.project.name.length).toBeGreaterThan(0);
        expect(panel.project.pitch.length).toBeGreaterThan(0);
        expect(panel.project.statusLabel.length).toBeGreaterThan(0);
      }
    // Demo entries are clearly marked in both languages.
    for (const p of IN_PROGRESS.filter((x) => x.demo)) {
      expect(p.name.en).toMatch(/demo/i);
      expect(p.name.ar).toMatch(/تجريبي/);
    }
  });
});
