/**
 * Mayor routes and tours on the walk world: hex spots to world points, path planning that
 * ignores the mayor's own collider, and validation (every waypoint and tour stop walkable,
 * standable and reachable; pauses clear of the doors). Pure: no three or react imports.
 */

import type { HexRef, IslandStory } from "@/lib/content/tours";
import { canStand } from "../logic/collision";
import { hexDistance } from "../logic/hex";
import {
  cellNodeId,
  findNodePath,
  findPath,
  nodeAt,
  reachableFrom,
  type NavGraph,
} from "../logic/pathfinding";
import type { Island3D } from "../logic/types";
import type { CircleObstacle, Obstacle } from "../logic/walk-grid";
import type { Vec3, WalkWorld } from "../logic/walk-world";
import { NPC_RADIUS } from "../logic/world-layout";

export type StoryWorld = {
  walk: WalkWorld;
  nav: NavGraph;
  islands: readonly Island3D[];
};

/** World point (cell centre, ground height) of an island hex, or null if it has no tile. */
export function spotToWorld(
  world: Pick<StoryWorld, "walk">,
  islandId: string,
  spot: HexRef
): Vec3 | null {
  const grid = world.walk.islands.find((g) => g.islandId === islandId);
  const cell = grid?.cells.get(`${spot.q},${spot.r}`);
  return cell ? { x: cell.x, y: cell.y, z: cell.z } : null;
}

/** The circle collider the walk world keeps for a mayor (moved at runtime as they walk). */
export function mayorObstacle(
  walk: WalkWorld,
  islandId: string,
  mayorId: string
): CircleObstacle | null {
  const grid = walk.islands.find((g) => g.islandId === islandId);
  const o = grid?.obstacles.find(
    (ob: Obstacle): ob is CircleObstacle =>
      ob.shape === "circle" && ob.source === mayorId
  );
  return o ?? null;
}

/** Run `fn` with an obstacle switched off (radius 0), restoring it afterwards. */
export function withoutObstacle<T>(o: CircleObstacle | null, fn: () => T): T {
  if (!o) return fn();
  const radius = o.radius;
  o.radius = 0;
  try {
    return fn();
  } finally {
    o.radius = radius;
  }
}

/** A path for a mayor from `from` to `to` (its own collider ignored), or null. */
export function planMayorPath(
  world: Pick<StoryWorld, "walk" | "nav">,
  self: CircleObstacle | null,
  from: Vec3,
  to: Vec3
): Vec3[] | null {
  return withoutObstacle(self, () =>
    findPath(world.walk, world.nav, from, to, NPC_RADIUS)
  );
}

export type SpotProblem = {
  index: number;
  spot: HexRef;
  reason:
    | "no-tile"
    | "not-walkable"
    | "not-standable"
    | "unreachable"
    | "door"
    | "near-door";
};

function startNode(world: StoryWorld, island: Island3D): string | null {
  const s = island.spawns?.player;
  if (!s) return null;
  const id = cellNodeId(island.id, s.q, s.r);
  if (world.nav.nodes.has(id)) return id;
  const p = spotToWorld(world, island.id, s);
  return p ? (nodeAt(world.walk, world.nav, p.x, p.z, p.y)?.id ?? null) : null;
}

/**
 * Check spots on an island: each must be a nav node reachable from the player spawn (so
 * the mayor and the player can both get there), standable for the mayor's collider (its
 * own collider ignored), and not on a door hex. With `doorClearance` (in hexes) the spot
 * must also keep that far from every door (pause points must not block a doorway).
 */
export function checkSpots(
  world: StoryWorld,
  islandId: string,
  mayorId: string,
  spots: readonly HexRef[],
  doorClearance = 0
): SpotProblem[] {
  const island = world.islands.find((i) => i.id === islandId);
  if (!island)
    return spots.map((spot, index) => ({ index, spot, reason: "no-tile" }));
  const start = startNode(world, island);
  const seen = start ? reachableFrom(world.nav, start) : new Set<string>();
  const self = mayorObstacle(world.walk, islandId, mayorId);
  const problems: SpotProblem[] = [];
  spots.forEach((spot, index) => {
    const p = spotToWorld(world, islandId, spot);
    const add = (reason: SpotProblem["reason"]): void => {
      problems.push({ index, spot, reason });
    };
    if (!p) return add("no-tile");
    const id = cellNodeId(islandId, spot.q, spot.r);
    if (!world.nav.nodes.has(id)) return add("not-walkable");
    if (!seen.has(id)) return add("unreachable");
    const stand = withoutObstacle(self, () =>
      canStand(world.walk, p.x, p.z, NPC_RADIUS)
    );
    if (!stand) return add("not-standable");
    for (const door of island.doors ?? []) {
      const d = hexDistance(spot, door);
      if (d === 0) return add("door");
      if (d < doorClearance) return add("near-door");
    }
  });
  return problems;
}

/** Route rules: 3-5 waypoints, each a valid pause point at least 2 hexes from any door. */
export function validateRoute(
  world: StoryWorld,
  story: Pick<IslandStory, "islandId" | "mayorId" | "route">
): string[] {
  const out: string[] = [];
  const n = story.route.length;
  if (n < 3 || n > 5) out.push(`route has ${n} waypoints (3-5)`);
  for (const p of checkSpots(
    world,
    story.islandId,
    story.mayorId,
    story.route,
    2
  ))
    out.push(`waypoint ${p.index} (${p.spot.q},${p.spot.r}): ${p.reason}`);
  return out;
}

/**
 * Tour rules: 2-4 stops, each a valid standing spot (not on a door), and each leg (spawn
 * to the first stop, then stop to stop, then back to the route) has a path.
 */
export function validateTour(
  world: StoryWorld,
  story: Pick<IslandStory, "islandId" | "mayorId" | "tour" | "route">
): string[] {
  const out: string[] = [];
  const n = story.tour.length;
  if (n < 2 || n > 4) out.push(`tour has ${n} stops (2-4)`);
  const stands = story.tour.map((s) => s.stand);
  for (const p of checkSpots(world, story.islandId, story.mayorId, stands))
    out.push(`stop ${p.index} (${p.spot.q},${p.spot.r}): ${p.reason}`);
  const chain = [story.route[0], ...stands, story.route[0]].filter(
    (s): s is HexRef => Boolean(s)
  );
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i] as HexRef;
    const b = chain[i + 1] as HexRef;
    const path = findNodePath(
      world.nav,
      cellNodeId(story.islandId, a.q, a.r),
      cellNodeId(story.islandId, b.q, b.r)
    );
    if (!path) out.push(`no path from (${a.q},${a.r}) to (${b.q},${b.r})`);
  }
  return out;
}

/** The next route index for loop / ping-pong walking (direction updated in place). */
export function nextRouteIndex(
  index: number,
  dir: { value: 1 | -1 },
  length: number,
  mode: "loop" | "pingpong"
): number {
  if (length <= 1) return 0;
  if (mode === "loop") return (index + 1) % length;
  let next = index + dir.value;
  if (next < 0 || next >= length) {
    dir.value = dir.value === 1 ? -1 : 1;
    next = index + dir.value;
  }
  return next;
}

/** Index of the route waypoint nearest to a point. */
export function nearestIndex(
  points: readonly Vec3[],
  x: number,
  z: number
): number {
  let best = 0;
  let bestD = Infinity;
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * Move a walking mayor's collider and talk prompt to their position (the prompt is off,
 * range 0, while they give a tour).
 */
export function syncMayor(
  npc: { x: number; y: number; z: number; range: number },
  self: CircleObstacle | null,
  pos: Vec3,
  range: number
): void {
  if (self) {
    self.x = pos.x;
    self.z = pos.z;
  }
  npc.x = pos.x;
  npc.y = pos.y;
  npc.z = pos.z;
  npc.range = range;
}
