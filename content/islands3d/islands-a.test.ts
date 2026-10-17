/**
 * Island designer group "a": home and khidmty. Loads both islands with the real manifest
 * (plus fragments), builds the world with the bridges between them and checks that every
 * door, the mayor and every anchor is reachable, that the shapes stay within their layout
 * radius, and that only known, non-banned models are used.
 */

import { describe, expect, it } from "vitest";

import { hexKey, hexNeighbours } from "@/components/game3d/logic/hex";
import { checkIslandReachability } from "@/components/game3d/logic/pathfinding";
import {
  islandProblems,
  parseIsland3D,
} from "@/components/game3d/logic/validate-island";
import { islandHexToWorld } from "@/components/game3d/logic/walk-grid";
import {
  buildGameWorld,
  type MayorInfo,
} from "@/components/game3d/logic/world-layout";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";
import { BRIDGES, ISLANDS } from "@/lib/content/world";

import homeJson from "./home.json";
import khidmtyJson from "./khidmty.json";

const home = parseIsland3D(homeJson, "home.json");
const khidmty = parseIsland3D(khidmtyJson, "khidmty.json");
const islands = [home, khidmty];
const manifest = readManifestFromDisk();
const size = 2 / Math.sqrt(3);

const LAYOUT: Record<string, { center: [number, number]; radius: number }> = {
  home: { center: [0, 0], radius: 17 },
  khidmty: { center: [0, -38], radius: 11 },
};

const mayors: Record<string, MayorInfo | undefined> = Object.fromEntries(
  ISLANDS.map((i) => [
    i.id,
    i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
  ])
);
const links = BRIDGES.filter(
  (b) =>
    islands.some((i) => i.id === b.from) && islands.some((i) => i.id === b.to)
);

describe("group a islands (home, khidmty)", () => {
  const world = buildGameWorld(islands, links, mayors, manifest);

  it.each(islands.map((i) => [i.id, i] as const))(
    "%s parses cleanly and is no longer a placeholder",
    (_id, island) => {
      expect(islandProblems(island)).toEqual([]);
      expect(island.placeholder).toBeFalsy();
    }
  );

  it.each(islands.map((i) => [i.id, i] as const))(
    "%s uses only known, non-banned models",
    (_id, island) => {
      const names = [
        ...island.hexes.map((h) => h.tile),
        ...(island.objects ?? []).map((o) => o.model),
      ];
      const bad = names.filter(
        (n) => !manifest.models[n] || manifest.models[n]?.banned
      );
      expect(bad).toEqual([]);
    }
  );

  it.each(islands.map((i) => [i.id, i] as const))(
    "%s reaches every door, the mayor and every anchor from the spawn",
    (_id, island) => {
      expect(checkIslandReachability(world.walk, island).unreachable).toEqual(
        []
      );
    }
  );

  it.each(islands.map((i) => [i.id, i] as const))(
    "%s stays inside its layout circle with anchors on the rim",
    (id, island) => {
      const layout = LAYOUT[id];
      expect(layout).toBeDefined();
      if (!layout) return;
      expect(
        Math.hypot(
          island.center[0] - layout.center[0],
          island.center[1] - layout.center[1]
        )
      ).toBeLessThanOrEqual(4);
      for (const h of island.hexes) {
        const p = islandHexToWorld(island, h.q, h.r, size);
        const d = Math.hypot(p.x - layout.center[0], p.z - layout.center[1]);
        expect(d + size, `${id} hex ${h.q},${h.r}`).toBeLessThanOrEqual(
          layout.radius
        );
      }
      const keys = new Set(island.hexes.map((h) => hexKey(h.q, h.r)));
      for (const a of island.anchors ?? []) {
        const open = hexNeighbours(a.q, a.r).filter(
          (n) => !keys.has(hexKey(n.q, n.r))
        );
        expect(open.length, `${a.id} is an edge hex`).toBeGreaterThan(0);
      }
    }
  );

  it("connects home and khidmty with a bridge", () => {
    const bridge = world.walk.bridges.find(
      (b) => b.from === "home" && b.to === "khidmty"
    );
    expect(bridge).toBeDefined();
    const a = home.anchors?.find((x) => x.id === "to_khidmty");
    const b = khidmty.anchors?.find((x) => x.id === "to_home");
    expect(bridge?.fromCell).toEqual({ q: a?.q, r: a?.r });
    expect(bridge?.toCell).toEqual({ q: b?.q, r: b?.r });
  });
});
