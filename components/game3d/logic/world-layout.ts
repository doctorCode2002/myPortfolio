/**
 * Assembles the playable world from the island JSON files, the bridges and mayors in
 * lib/content/world.ts, and the manifest: walk world, nav graph, doors and NPCs in world
 * space. Pure: no three or react imports.
 */

import { buildNavGraph, type NavGraph } from "./pathfinding";
import type { Island3D, Manifest } from "./types";
import { circumradiusFromWidth } from "./hex";
import { islandHexToWorld, resolveHexWidth } from "./walk-grid";
import { buildWalkWorld, type BridgeLink, type WalkWorld } from "./walk-world";

export type MayorInfo = { id: string; sprite: string };

export type Interactable = {
  kind: "door" | "npc";
  /** buildingId for doors, mayor id for NPCs. */
  id: string;
  islandId: string;
  x: number;
  y: number;
  z: number;
  /** Interaction range in metres. */
  range: number;
  /** NPCs: the character sheet id used for the dialogue portrait. */
  charSheet?: string;
  /** Hex of the interactable. */
  q: number;
  r: number;
};

export type GameWorld = {
  islands: readonly Island3D[];
  walk: WalkWorld;
  nav: NavGraph;
  interactables: Interactable[];
  hexWidth: number;
  size: number;
};

export const PLAYER_RADIUS_HEX = 0.2;
export const NPC_RADIUS = 0.35;

export function buildGameWorld(
  islands: readonly Island3D[],
  links: readonly BridgeLink[],
  mayors: Readonly<Record<string, MayorInfo | undefined>>,
  manifest: Manifest | null
): GameWorld {
  const hexWidth = resolveHexWidth({ manifest });
  const size = circumradiusFromWidth(hexWidth);
  const npcs = islands.flatMap((island) => {
    const spot = island.spawns?.mayor;
    const mayor = mayors[island.id];
    return spot && mayor
      ? [
          {
            islandId: island.id,
            q: spot.q,
            r: spot.r,
            id: mayor.id,
            radius: NPC_RADIUS,
          },
        ]
      : [];
  });
  const walk = buildWalkWorld(islands, links, { manifest, npcs });
  const nav = buildNavGraph(walk);

  const interactables: Interactable[] = [];
  for (const island of islands) {
    const grid = walk.islands.find((g) => g.islandId === island.id);
    const yAt = (q: number, r: number): number =>
      grid?.cells.get(`${q},${r}`)?.y ?? island.baseY ?? 0;
    for (const door of island.doors ?? []) {
      const p = islandHexToWorld(island, door.q, door.r, size);
      interactables.push({
        kind: "door",
        id: door.buildingId,
        islandId: island.id,
        x: p.x,
        y: yAt(door.q, door.r),
        z: p.z,
        range: (door.radius ?? 0.9) * hexWidth,
        q: door.q,
        r: door.r,
      });
    }
    const spot = island.spawns?.mayor;
    const mayor = mayors[island.id];
    if (spot && mayor) {
      const p = islandHexToWorld(island, spot.q, spot.r, size);
      interactables.push({
        kind: "npc",
        id: mayor.id,
        islandId: island.id,
        x: p.x,
        y: yAt(spot.q, spot.r),
        z: p.z,
        range: hexWidth * 0.95,
        charSheet: mayor.sprite,
        q: spot.q,
        r: spot.r,
      });
    }
  }
  return { islands, walk, nav, interactables, hexWidth, size };
}

/** The interactable closest to (x, z) that is in range, if any. */
export function nearestInteractable(
  items: readonly Interactable[],
  x: number,
  y: number,
  z: number
): { item: Interactable; dist: number } | null {
  let best: { item: Interactable; dist: number } | null = null;
  for (const item of items) {
    if (Math.abs(item.y - y) > 1.5) continue;
    const d = Math.hypot(item.x - x, item.z - z);
    if (d <= item.range && (!best || d < best.dist)) best = { item, dist: d };
  }
  return best;
}

/** World position of an island's player spawn (centre of the spawn hex). */
export function spawnPoint(
  world: GameWorld,
  islandId: string
): { x: number; y: number; z: number } {
  const island =
    world.islands.find((i) => i.id === islandId) ?? world.islands[0];
  if (!island) return { x: 0, y: 0, z: 0 };
  const s = island.spawns?.player ?? { q: 0, r: 0 };
  const p = islandHexToWorld(island, s.q, s.r, world.size);
  const grid = world.walk.islands.find((g) => g.islandId === island.id);
  return {
    x: p.x,
    y: grid?.cells.get(`${s.q},${s.r}`)?.y ?? island.baseY ?? 0,
    z: p.z,
  };
}
