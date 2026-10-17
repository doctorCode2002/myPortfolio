/**
 * Navigation graph over the walk world (island hexes plus bridge stations), BFS
 * reachability, A* paths with string pulling, and ray picking of walkable ground.
 * Pure: no three or react imports.
 */

import { canStand } from "./collision";
import { hexKey, hexNeighbours } from "./hex";
import type { Island3D } from "./types";
import {
  cellHeightAt,
  isCellWalkable,
  obstacleDistance,
  worldToIslandHex,
  type IslandWalkGrid,
} from "./walk-grid";
import {
  bridgeHeightAt,
  surfaceAt,
  type Vec3,
  type WalkWorld,
} from "./walk-world";

export type NavNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  edges: string[];
};

export type NavGraph = { nodes: Map<string, NavNode> };

export function cellNodeId(islandId: string, q: number, r: number): string {
  return `${islandId}:${hexKey(q, r)}`;
}

function link(graph: NavGraph, a: string, b: string): void {
  const na = graph.nodes.get(a);
  const nb = graph.nodes.get(b);
  if (!na || !nb) return;
  if (!na.edges.includes(b)) na.edges.push(b);
  if (!nb.edges.includes(a)) nb.edges.push(a);
}

/** A hex is open for paths when walkable and no obstacle sits near its centre. */
function cellOpen(grid: IslandWalkGrid, x: number, z: number): boolean {
  for (const o of grid.obstacles) {
    if (obstacleDistance(o, x, z) < grid.size * 0.35) return false;
  }
  return true;
}

export function buildNavGraph(world: WalkWorld): NavGraph {
  const graph: NavGraph = { nodes: new Map() };
  for (const grid of world.islands) {
    for (const cell of grid.cells.values()) {
      if (!isCellWalkable(cell) || !cellOpen(grid, cell.x, cell.z)) continue;
      const id = cellNodeId(grid.islandId, cell.q, cell.r);
      graph.nodes.set(id, { id, x: cell.x, y: cell.y, z: cell.z, edges: [] });
    }
    for (const cell of grid.cells.values()) {
      const id = cellNodeId(grid.islandId, cell.q, cell.r);
      if (!graph.nodes.has(id)) continue;
      for (const n of hexNeighbours(cell.q, cell.r)) {
        const other = grid.cells.get(hexKey(n.q, n.r));
        if (!other) continue;
        // Compare heights where the two hexes meet (slopes are low on one side only).
        const mx = (cell.x + other.x) / 2;
        const mz = (cell.z + other.z) / 2;
        const ha = cellHeightAt(cell, mx, mz, grid.hexWidth);
        const hb = cellHeightAt(other, mx, mz, grid.hexWidth);
        if (Math.abs(ha - hb) > world.maxStep) continue;
        link(graph, id, cellNodeId(grid.islandId, n.q, n.r));
      }
    }
  }
  for (const bridge of world.bridges) {
    const stations = Math.max(2, Math.ceil(bridge.length / 1.2));
    let prev = cellNodeId(bridge.from, bridge.fromCell.q, bridge.fromCell.r);
    for (let i = 1; i < stations; i++) {
      const t = i / stations;
      const id = `bridge:${bridge.id}:${i}`;
      graph.nodes.set(id, {
        id,
        x: bridge.a.x + (bridge.b.x - bridge.a.x) * t,
        y: bridgeHeightAt(bridge, t),
        z: bridge.a.z + (bridge.b.z - bridge.a.z) * t,
        edges: [],
      });
      link(graph, prev, id);
      prev = id;
    }
    link(graph, prev, cellNodeId(bridge.to, bridge.toCell.q, bridge.toCell.r));
  }
  return graph;
}

/** The graph node under (or nearest to) a world point. */
export function nodeAt(
  world: WalkWorld,
  graph: NavGraph,
  x: number,
  z: number,
  nearY?: number
): NavNode | null {
  const s = surfaceAt(world, x, z, nearY);
  if (s?.islandId && s.cell) {
    const node = graph.nodes.get(cellNodeId(s.islandId, s.cell.q, s.cell.r));
    if (node) return node;
  }
  // Nearest node within two hexes (bridge stations, or a hex whose centre holds a prop).
  let best: NavNode | null = null;
  let bestD = world.hexWidth * 2;
  for (const node of graph.nodes.values()) {
    const d =
      Math.hypot(node.x - x, node.z - z) +
      (nearY !== undefined ? Math.abs(node.y - nearY) * 0.5 : 0);
    if (d < bestD) {
      bestD = d;
      best = node;
    }
  }
  return best;
}

/** Every node id reachable from `start` (breadth-first). */
export function reachableFrom(graph: NavGraph, start: string): Set<string> {
  const seen = new Set<string>();
  if (!graph.nodes.has(start)) return seen;
  const queue = [start];
  seen.add(start);
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const next of graph.nodes.get(id)?.edges ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** A* between two nodes; returns node ids from start to goal, or null. */
export function findNodePath(
  graph: NavGraph,
  start: string,
  goal: string
): string[] | null {
  const goalNode = graph.nodes.get(goal);
  if (!graph.nodes.has(start) || !goalNode) return null;
  const h = (id: string): number => {
    const n = graph.nodes.get(id) as NavNode;
    return Math.hypot(n.x - goalNode.x, n.z - goalNode.z);
  };
  const open = new Set([start]);
  const came = new Map<string, string>();
  const g = new Map<string, number>([[start, 0]]);
  const f = new Map<string, number>([[start, h(start)]]);
  while (open.size > 0) {
    let current = "";
    let bestF = Infinity;
    for (const id of open) {
      const v = f.get(id) ?? Infinity;
      if (v < bestF) {
        bestF = v;
        current = id;
      }
    }
    if (current === goal) {
      const path = [current];
      while (came.has(current)) {
        current = came.get(current) as string;
        path.unshift(current);
      }
      return path;
    }
    open.delete(current);
    const cn = graph.nodes.get(current) as NavNode;
    for (const next of cn.edges) {
      const nn = graph.nodes.get(next) as NavNode;
      const tentative =
        (g.get(current) ?? Infinity) +
        Math.hypot(nn.x - cn.x, nn.z - cn.z, nn.y - cn.y);
      if (tentative < (g.get(next) ?? Infinity)) {
        came.set(next, current);
        g.set(next, tentative);
        f.set(next, tentative + h(next));
        open.add(next);
      }
    }
  }
  return null;
}

/** True when a circle can walk the straight line between two points. */
export function lineWalkable(
  world: WalkWorld,
  from: Vec3,
  to: { x: number; z: number },
  radius: number
): boolean {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(d / (radius * 0.5)));
  let y = from.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const s = canStand(
      world,
      from.x + (to.x - from.x) * t,
      from.z + (to.z - from.z) * t,
      radius,
      y
    );
    if (!s) return false;
    y = s.y;
  }
  return true;
}

/**
 * Waypoints (world points) from `from` to `to`: A* over the nav graph, then string pulling
 * so the player walks straight wherever the circle collider allows. Null when unreachable.
 */
export function findPath(
  world: WalkWorld,
  graph: NavGraph,
  from: Vec3,
  to: { x: number; z: number },
  radius: number
): Vec3[] | null {
  const target = surfaceAt(world, to.x, to.z, from.y);
  const start = nodeAt(world, graph, from.x, from.z, from.y);
  const goal = nodeAt(world, graph, to.x, to.z, target?.y);
  if (!start || !goal) return null;
  const ids = findNodePath(graph, start.id, goal.id);
  if (!ids) return null;
  const points: Vec3[] = ids.map((id) => {
    const n = graph.nodes.get(id) as NavNode;
    return { x: n.x, y: n.y, z: n.z };
  });
  if (target && canStand(world, to.x, to.z, radius)) {
    points.push({ x: to.x, y: target.y, z: to.z });
  }
  // String pulling: from each anchor, jump to the farthest directly walkable point.
  const out: Vec3[] = [];
  let anchor: Vec3 = from;
  let i = 0;
  while (i < points.length) {
    let j = points.length - 1;
    while (j > i && !lineWalkable(world, anchor, points[j] as Vec3, radius))
      j--;
    const p = points[j] as Vec3;
    out.push(p);
    anchor = p;
    i = j + 1;
  }
  return out;
}

/**
 * March a ray (e.g. from the camera through the cursor) until it dips under walkable
 * ground. Returns the hit point or null. Cheap and independent of render meshes.
 */
export function raycastWalk(
  world: WalkWorld,
  origin: Vec3,
  dir: Vec3,
  maxDist = 120,
  step = 0.1
): Vec3 | null {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  const uz = dir.z / len;
  for (let d = 0; d <= maxDist; d += step) {
    const x = origin.x + ux * d;
    const y = origin.y + uy * d;
    const z = origin.z + uz * d;
    const s = surfaceAt(world, x, z, y);
    if (s && y <= s.y + 0.02 && y >= s.y - 0.6) return { x, y: s.y, z };
  }
  return null;
}

export type ReachabilityTarget = {
  kind: "door" | "mayor" | "anchor";
  id: string;
  q: number;
  r: number;
};

export type ReachabilityReport = {
  ok: boolean;
  spawn: string | null;
  unreachable: ReachabilityTarget[];
};

/**
 * Check an island inside a walk world: from the player spawn, every door, the mayor and
 * every anchor must be reachable. A target counts as reached when its own hex or one of
 * its neighbours is reachable (doors and mayors usually stand next to the walkable hex).
 */
export function checkIslandReachability(
  world: WalkWorld,
  island: Island3D
): ReachabilityReport {
  const graph = buildNavGraph(world);
  const grid = world.islands.find((g) => g.islandId === island.id);
  const spawnHex = island.spawns?.player;
  const targets: ReachabilityTarget[] = [
    ...(island.doors ?? []).map((d) => ({
      kind: "door" as const,
      id: d.buildingId,
      q: d.q,
      r: d.r,
    })),
    ...(island.spawns?.mayor
      ? [
          {
            kind: "mayor" as const,
            id: "mayor",
            q: island.spawns.mayor.q,
            r: island.spawns.mayor.r,
          },
        ]
      : []),
    ...(island.anchors ?? []).map((a) => ({
      kind: "anchor" as const,
      id: a.id,
      q: a.q,
      r: a.r,
    })),
  ];
  if (!grid || !spawnHex)
    return { ok: false, spawn: null, unreachable: targets };
  let spawnId = cellNodeId(island.id, spawnHex.q, spawnHex.r);
  if (!graph.nodes.has(spawnId)) {
    const cell = grid.cells.get(hexKey(spawnHex.q, spawnHex.r));
    const near = cell ? nodeAt(world, graph, cell.x, cell.z, cell.y) : null;
    if (!near) return { ok: false, spawn: null, unreachable: targets };
    spawnId = near.id;
  }
  const seen = reachableFrom(graph, spawnId);
  const unreachable = targets.filter((t) => {
    const ids = [{ q: t.q, r: t.r }, ...hexNeighbours(t.q, t.r)].map((h) =>
      cellNodeId(island.id, h.q, h.r)
    );
    return !ids.some((id) => seen.has(id));
  });
  return { ok: unreachable.length === 0, spawn: spawnId, unreachable };
}

/** Axial coordinates of a world point on a given island grid (re-exported for HUDs). */
export { worldToIslandHex };
