/**
 * Assembles the playable world from the island JSON files, the bridges and mayors in
 * lib/content/world.ts, and the manifest: walk world, nav graph, doors and NPCs in world
 * space. Pure: no three or react imports.
 */

import { buildNavGraph, type NavGraph } from "./pathfinding";
import { chunkPalette, propClass } from "./breakables";
import { createCarEnv, type CarEnv } from "./car";
import {
  needsBounds,
  objectCollision,
  objectKind,
  type ModelLocalBounds,
} from "./catalog";
import { buildMovementLayout, type MovementLayout } from "./movement-layout";
import { buildRoadNetwork, type RoadNetwork } from "./roads";
import type { Island3D, Manifest } from "./types";
import { circumradiusFromWidth, hexKey } from "./hex";
import { buildRails, type Rail } from "./rails";
import {
  collisionObstacle,
  islandHexToWorld,
  objectKey,
  resolveHexWidth,
  type Obstacle,
} from "./walk-grid";
import { buildWalkWorld, type BridgeLink, type WalkWorld } from "./walk-world";

export type MayorInfo = { id: string; sprite: string };

export type Interactable = {
  kind: "door" | "npc" | "vehicle";
  /** buildingId for doors, mayor id for NPCs, vehicle id for the car. */
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

/** A breakable island object (smashed by the car, regrows later). */
export type PropInfo = {
  /** Object key (`<islandId>:<index>`), shared by its obstacle and its instance. */
  key: string;
  islandId: string;
  model: string;
  /** Ground position of the object. */
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** Measured size in metres (after the manifest and object scales). */
  size: [number, number, number];
  /** sRGB chunk colours. */
  palette: string[];
  /** Tall, thin props (trees, lamps) topple as one long piece plus shards. */
  tall: boolean;
  /** Its plan-view collider (for non-solid props like low fences: a car-only sensor). */
  obstacle: Obstacle;
  /** True when the prop does not block walking (only the car notices it). */
  sensor: boolean;
};

/** Non-solid decor the car drives through without smashing (flowers, grass, lilies). */
const SOFT_DECOR =
  /flower|grass|lily|waterplant|blooms|decal|crop|leafs|petal/i;

/** A parked vehicle's spawn in world space. */
export type VehicleSpawn = {
  id: string;
  islandId: string;
  x: number;
  y: number;
  z: number;
  heading: number;
};

export type GameWorld = {
  islands: readonly Island3D[];
  walk: WalkWorld;
  nav: NavGraph;
  interactables: Interactable[];
  hexWidth: number;
  size: number;
  /** Breakable props by object key. */
  props: Map<string, PropInfo>;
  vehicles: VehicleSpawn[];
  /** Rim and bridge rails that keep the car on the walkable area. */
  rails: Rail[];
  /** Collision data for the car controller. */
  carEnv: CarEnv;
  /** Glider launches, jump pads, lookouts and thermals. */
  movement: MovementLayout;
};

/** Vehicle interaction range (metres from the car's centre). */
export const VEHICLE_RANGE = 1.9;

/** Breakable props of every island, by object key (only objects with a collider). */
export function buildProps(
  islands: readonly Island3D[],
  walk: WalkWorld,
  manifest: Manifest | null,
  bounds: Readonly<Record<string, ModelLocalBounds | null | undefined>> = {}
): Map<string, PropInfo> {
  const props = new Map<string, PropInfo>();
  for (const island of islands) {
    const grid = walk.islands.find((g) => g.islandId === island.id);
    if (!grid) continue;
    const byKey = new Map(grid.obstacles.map((o) => [o.key, o]));
    (island.objects ?? []).forEach((obj, index) => {
      const key = objectKey(island.id, index);
      if (propClass(obj.model, manifest) !== "breakable") return;
      const cell = grid.cells.get(hexKey(obj.q, obj.r));
      if (!cell || cell.water) return;
      const x = cell.x + (obj.offset?.[0] ?? 0);
      const z = cell.z + (obj.offset?.[1] ?? 0);
      let obstacle = byKey.get(key) ?? null;
      const sensor = !obstacle;
      if (!obstacle) {
        // Non-solid props (low fences, hedges marked walk-through) still break under the car.
        const text = [obj.model, ...(manifest?.models[obj.model]?.tags ?? [])];
        if (SOFT_DECOR.test(text.join(" "))) return;
        const col = objectCollision(
          { ...obj, solid: true },
          manifest,
          grid.hexWidth,
          bounds[obj.model] ?? null
        );
        obstacle = collisionObstacle(col, obj, x, z, key);
      }
      if (!obstacle) return;
      const m = manifest?.models[obj.model];
      const k = obj.scale ?? 1;
      const size: [number, number, number] = m?.size
        ? [m.size[0] * k, m.size[1] * k, m.size[2] * k]
        : [0.5 * k, 0.8 * k, 0.5 * k];
      const kind = objectKind(obj.model, manifest);
      props.set(key, {
        key,
        islandId: island.id,
        model: obj.model,
        x,
        y: cell.y,
        z,
        rotY: ((obj.rot ?? 0) * Math.PI) / 180,
        size,
        palette: chunkPalette(obj.model, manifest),
        tall:
          kind === "tree" ||
          (size[1] > 1.2 && size[1] > 2 * Math.max(size[0], size[2])),
        obstacle,
        sensor,
      });
    });
  }
  return props;
}

export const PLAYER_RADIUS_HEX = 0.2;
export const NPC_RADIUS = 0.35;

export function buildGameWorld(
  islands: readonly Island3D[],
  links: readonly BridgeLink[],
  mayors: Readonly<Record<string, MayorInfo | undefined>>,
  manifest: Manifest | null,
  opts: {
    bounds?: Readonly<Record<string, ModelLocalBounds | null | undefined>>;
  } = {}
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
  const walk = buildWalkWorld(islands, links, {
    manifest,
    npcs,
    ...(opts.bounds ? { bounds: opts.bounds } : {}),
  });
  // Lookout towers block their hexes and add their decks: before the nav graph.
  const movement = buildMovementLayout(islands, walk, manifest);
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
  const vehicles: VehicleSpawn[] = [];
  for (const island of islands) {
    const grid = walk.islands.find((g) => g.islandId === island.id);
    for (const v of island.vehicles ?? []) {
      const p = islandHexToWorld(island, v.q, v.r, size);
      const y = grid?.cells.get(hexKey(v.q, v.r))?.y ?? island.baseY ?? 0;
      vehicles.push({
        id: v.id,
        islandId: island.id,
        x: p.x,
        y,
        z: p.z,
        heading: ((v.rot ?? 0) * Math.PI) / 180,
      });
      interactables.push({
        kind: "vehicle",
        id: v.id,
        islandId: island.id,
        x: p.x,
        y,
        z: p.z,
        range: VEHICLE_RANGE,
        q: v.q,
        r: v.r,
      });
    }
  }
  const props = buildProps(islands, walk, manifest, opts.bounds);
  const rails = buildRails(walk);
  const roads = new Map<string, RoadNetwork>();
  for (const island of islands) {
    const grid = walk.islands.find((g) => g.islandId === island.id);
    if (grid)
      roads.set(
        island.id,
        buildRoadNetwork(island, grid, {
          heightJitter: island.heightJitter ?? 0,
        })
      );
  }
  const carEnv = createCarEnv(
    walk,
    rails,
    new Set(props.keys()),
    [...props.values()].filter((p) => p.sensor).map((p) => p.obstacle),
    roads
  );
  return {
    islands,
    walk,
    nav,
    interactables,
    hexWidth,
    size,
    props,
    vehicles,
    rails,
    carEnv,
    movement,
  };
}

/** Keep the vehicle prompts on the car as it moves. */
export function moveVehiclePrompt(
  items: Interactable[],
  car: { x: number; y: number; z: number; islandId: string | null }
): void {
  for (const it of items) {
    if (it.kind !== "vehicle") continue;
    it.x = car.x;
    it.y = car.y;
    it.z = car.z;
    if (car.islandId) it.islandId = car.islandId;
  }
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

/** Names of the models whose colliders need real geometry bounds (see catalog.needsBounds). */
export function modelsNeedingBounds(
  islands: readonly Island3D[],
  manifest: Manifest | null
): string[] {
  const names = new Set<string>();
  for (const island of islands)
    for (const o of island.objects ?? [])
      if (needsBounds(o.model, manifest) && manifest?.models[o.model])
        names.add(o.model);
  return [...names];
}
