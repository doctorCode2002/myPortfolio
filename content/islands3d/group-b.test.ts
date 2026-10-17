import { describe, expect, it } from "vitest";

import { readManifestFromDisk } from "@/lib/content/manifest3d.node";
import { ISLANDS } from "@/lib/content/world";
import {
  hexKey,
  hexNeighbours,
  hexToWorld,
} from "@/components/game3d/logic/hex";
import {
  cellNodeId,
  checkIslandReachability,
  findNodePath,
  lineWalkable,
} from "@/components/game3d/logic/pathfinding";
import {
  islandProblems,
  parseIsland3D,
} from "@/components/game3d/logic/validate-island";
import {
  buildGameWorld,
  PLAYER_RADIUS_HEX,
  type MayorInfo,
} from "@/components/game3d/logic/world-layout";
import civicmindJson from "./civicmind.json";
import onyxJson from "./onyx.json";

const manifest = readManifestFromDisk();
const R = 2 / Math.sqrt(3);

const CASES = [
  { json: civicmindJson, id: "civicmind", plan: [38, -16], baseY: 2 },
  { json: onyxJson, id: "onyx", plan: [32, 26], baseY: -1 },
] as const;

const mayors: Record<string, MayorInfo | undefined> = Object.fromEntries(
  ISLANDS.map((i) => [
    i.id,
    i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
  ])
);

describe.each(CASES)("island $id (group b)", ({ json, id, plan, baseY }) => {
  const island = parseIsland3D(json, `${id}.json`);

  it("parses cleanly with no content problems", () => {
    expect(island.id).toBe(id);
    expect(islandProblems(island)).toEqual([]);
  });

  it("sits at its planned place within an 11 m radius", () => {
    expect(Math.abs(island.center[0] - plan[0])).toBeLessThanOrEqual(4);
    expect(Math.abs(island.center[1] - plan[1])).toBeLessThanOrEqual(4);
    expect(island.baseY).toBe(baseY);
    for (const h of island.hexes) {
      const p = hexToWorld(h.q, h.r, R);
      expect(Math.hypot(p.x, p.z) + R, hexKey(h.q, h.r)).toBeLessThanOrEqual(
        11
      );
    }
  });

  it("uses only known, unbanned models", () => {
    for (const name of [
      ...island.hexes.map((h) => h.tile),
      ...(island.objects ?? []).map((o) => o.model),
    ]) {
      expect(manifest.models[name], name).toBeDefined();
      expect(manifest.models[name]?.banned, name).toBeFalsy();
    }
  });

  it("has its portal door, the mayor and a to_home anchor on the edge", () => {
    expect(island.doors?.map((d) => d.buildingId)).toEqual([`portal_${id}`]);
    expect(island.spawns?.mayor).toBeDefined();
    const keys = new Set(island.hexes.map((h) => hexKey(h.q, h.r)));
    const anchor = island.anchors?.find((a) => a.id === "to_home");
    expect(anchor).toBeDefined();
    const missing = hexNeighbours(anchor!.q, anchor!.r).filter(
      (n) => !keys.has(hexKey(n.q, n.r))
    );
    expect(missing.length).toBeGreaterThan(0);
  });

  it("reaches the door, the mayor and every anchor with measured collisions", () => {
    const world = buildGameWorld([island], [], mayors, manifest);
    const report = checkIslandReachability(world.walk, island);
    expect(report.unreachable).toEqual([]);
    expect(world.interactables.map((i) => i.id).sort()).toEqual(
      [`portal_${id}`, `mayor_${id}`].sort()
    );
  });

  it("lets the player's collider walk every path step from the spawn", () => {
    const world = buildGameWorld([island], [], mayors, manifest);
    const radius = PLAYER_RADIUS_HEX * world.hexWidth;
    const spawn = island.spawns!.player!;
    const start = cellNodeId(id, spawn.q, spawn.r);
    expect(world.nav.nodes.has(start), "spawn hex is open").toBe(true);
    const goals = [
      ...(island.doors ?? []),
      ...(island.anchors ?? []),
      island.spawns!.mayor!,
    ];
    for (const goal of goals) {
      const candidates = [
        { q: goal.q, r: goal.r },
        ...hexNeighbours(goal.q, goal.r),
      ]
        .map((h) => cellNodeId(id, h.q, h.r))
        .filter((n) => world.nav.nodes.has(n));
      const path = candidates
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
});
