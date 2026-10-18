/**
 * Every sky shard and signal fire stands where a player can walk to it from the home
 * spawn, with the real manifest and the measured model bounds (as the game builds it).
 */

import { describe, expect, it } from "vitest";

import { ISLANDS_3D } from "@/content/islands3d";
import {
  FIRE_RANGE,
  META_ISLANDS,
  SHARD_PICKUP_RANGE,
  SHARDS,
  SIGNAL_FIRES,
} from "@/lib/content/collectibles";
import { BRIDGES, ISLANDS } from "@/lib/content/world";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";
import { readModelBoundsFromDisk } from "../logic/bounds.node";
import { canStand } from "../logic/collision";
import {
  buildGameWorld,
  PLAYER_RADIUS_HEX,
  spawnPoint,
} from "../logic/world-layout";
import { buildMapData, placeFires, placeShards } from "./placement";

const manifest = readManifestFromDisk();
const mayors = Object.fromEntries(
  ISLANDS.map((i) => [
    i.id,
    i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
  ])
);
const world = buildGameWorld(ISLANDS_3D, BRIDGES, mayors, manifest, {
  bounds: readModelBoundsFromDisk(ISLANDS_3D, manifest),
});
const radius = PLAYER_RADIUS_HEX * world.hexWidth;
const home = spawnPoint(world, "home");

/**
 * Continuous reachability on foot: a flood fill over a fine grid of standable points
 * from the home spawn, stepping only where the player's circle collider can stand coming
 * from the previous point (so height steps, cliffs, obstacles and bridges all count).
 */
const STEP = 0.25;
const reached = (() => {
  const seen = new Map<string, number>();
  const key = (i: number, j: number): string => `${i},${j}`;
  const i0 = Math.round(home.x / STEP);
  const j0 = Math.round(home.z / STEP);
  const s0 = canStand(world.walk, i0 * STEP, j0 * STEP, radius);
  if (!s0) return seen;
  seen.set(key(i0, j0), s0.y);
  const queue: [number, number, number][] = [[i0, j0, s0.y]];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let h = 0; h < queue.length; h++) {
    const [i, j, y] = queue[h]!;
    for (const [di, dj] of dirs) {
      const k = key(i + di, j + dj);
      if (seen.has(k)) continue;
      const s = canStand(
        world.walk,
        (i + di) * STEP,
        (j + dj) * STEP,
        radius,
        y
      );
      if (!s) continue;
      seen.set(k, s.y);
      queue.push([i + di, j + dj, s.y]);
    }
  }
  return seen;
})();

/** True when the player can walk to within `range` (horizontal) of (x, y, z). */
function reachableNear(
  x: number,
  y: number,
  z: number,
  range: number
): boolean {
  const n = Math.ceil(range / STEP);
  const ci = Math.round(x / STEP);
  const cj = Math.round(z / STEP);
  for (let i = ci - n; i <= ci + n; i++)
    for (let j = cj - n; j <= cj + n; j++) {
      const gy = reached.get(`${i},${j}`);
      if (gy === undefined) continue;
      if (Math.hypot(i * STEP - x, j * STEP - z) > range) continue;
      if (Math.abs(gy - y) < 1.2) return true;
    }
  return false;
}

describe("sky shards", () => {
  const placed = placeShards(world);

  it("has unique shards, two on each island", () => {
    expect(SHARDS).toHaveLength(META_ISLANDS.length * 2);
    expect(new Set(SHARDS.map((s) => s.id)).size).toBe(SHARDS.length);
    for (const id of META_ISLANDS)
      expect(
        SHARDS.filter((s) => s.islandId === id),
        id
      ).toHaveLength(2);
    expect(placed).toHaveLength(SHARDS.length);
  });

  it.each(SHARDS.map((s) => [s.id] as const))(
    "%s is reachable on foot",
    (id) => {
      const p = placed.find((s) => s.id === id)!;
      expect(reachableNear(p.x, p.ground, p.z, SHARD_PICKUP_RANGE * 0.75)).toBe(
        true
      );
    }
  );

  it("keeps shards apart (no two in one pickup circle)", () => {
    for (const a of placed)
      for (const b of placed)
        if (a !== b)
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(2);
  });
});

describe("signal fires", () => {
  const fires = placeFires(world);

  it("has one fire per island", () => {
    expect(Object.keys(SIGNAL_FIRES).sort()).toEqual([...META_ISLANDS].sort());
    expect(fires).toHaveLength(META_ISLANDS.length);
  });

  it.each(fires.map((f) => [f.id, f] as const))(
    "%s can be lit and travelled to",
    (_id, f) => {
      expect(reachableNear(f.x, f.ground, f.z, FIRE_RANGE * 0.7)).toBe(true);
    }
  );
});

describe("minimap data", () => {
  it("draws every island and bridge inside its bounds", () => {
    const map = buildMapData(world);
    expect(map.islands.map((i) => i.islandId).sort()).toEqual(
      ISLANDS_3D.map((i) => i.id).sort()
    );
    expect(map.bridges).toHaveLength(BRIDGES.length);
    for (const i of map.islands) {
      expect(i.cx).toBeGreaterThan(map.minX);
      expect(i.cx).toBeLessThan(map.maxX);
    }
  });
});
