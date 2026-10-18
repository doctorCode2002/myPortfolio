/**
 * Road network of an island, derived from its KayKit road hexes (hex-road-*): which hex
 * edges each road tile connects, which neighbouring road hexes face each other, and
 * smooth centre lines (with junctions, dead ends and terrain-following height) that the
 * renderer turns into wide ribbons. Pure: no three or react imports.
 *
 * Connection table: the arms of each KayKit road tile at rotation 0, as indices into
 * HEX_DIRECTIONS (0 = E, 1 = NE, 2 = NW, 3 = W, 4 = SW, 5 = SE; direction k points at
 * 60k degrees counter-clockwise from +x seen from above, north = -z). Measured from the
 * models' geometry (the dirt-coloured, upward-facing triangles reaching each edge
 * midpoint). A tile rotated by `rot` degrees (around +y, like the walk grid's slopes)
 * connects arm (k + rot / 60) mod 6.
 *
 *   tile                    arms         shape
 *   hex-road-a              E W          straight
 *   hex-road-b              NE W         gentle bend (120 degrees between arms)
 *   hex-road-c              NW W         sharp bend (60 degrees)
 *   hex-road-d              NE W SE      Y junction
 *   hex-road-e              E NE W       straight with a branch
 *   hex-road-f              E W SE       straight with a branch (mirror of e)
 *   hex-road-g              NW W SW      three adjacent arms
 *   hex-road-h              E NW W SW    four arms (banned)
 *   hex-road-i              NE NW SW SE  four arms (banned)
 *   hex-road-j              E W SW SE    four arms
 *   hex-road-k              NE NW W SW SE five arms (banned)
 *   hex-road-l              all six      (banned)
 *   hex-road-m              W            dead end (the track stops at the centre)
 *   hex-road-a-sloped-low   E W          straight ramp, rises towards E (local +x)
 *   hex-road-a-sloped-high  E W          straight ramp, rises towards E (local +x)
 */

import { HEX_DIRECTIONS, hexKey, type Point2 } from "./hex";
import {
  cellAtWorld,
  cellHeightAt,
  groundLift,
  type IslandWalkGrid,
  type WalkCell,
} from "./walk-grid";

/** Width of the drawn road ribbons in metres (the car drives on these). */
export const ROAD_WIDTH = 2.2;

export const ROAD_TILE_ARMS: Readonly<Record<string, readonly number[]>> = {
  "hex-road-a": [0, 3],
  "hex-road-b": [1, 3],
  "hex-road-c": [2, 3],
  "hex-road-d": [1, 3, 5],
  "hex-road-e": [0, 1, 3],
  "hex-road-f": [0, 3, 5],
  "hex-road-g": [2, 3, 4],
  "hex-road-h": [0, 2, 3, 4],
  "hex-road-i": [1, 2, 4, 5],
  "hex-road-j": [0, 3, 4, 5],
  "hex-road-k": [1, 2, 3, 4, 5],
  "hex-road-l": [0, 1, 2, 3, 4, 5],
  "hex-road-m": [3],
  "hex-road-a-sloped-low": [0, 3],
  "hex-road-a-sloped-high": [0, 3],
};

export function isRoadTile(name: string): boolean {
  return /^hex-road-/i.test(name);
}

/** World arm directions (HEX_DIRECTIONS indices) of a road tile at a rotation; null if unknown. */
export function roadArms(tile: string, rotDeg = 0): number[] | null {
  const local = ROAD_TILE_ARMS[tile];
  if (!local) return null;
  const turn = Math.round(rotDeg / 60);
  const out = local.map((k) => (((k + turn) % 6) + 6) % 6);
  return [...new Set(out)].sort((a, b) => a - b);
}

/**
 * How a centre line ends: a round cap (dead end, or a stub onto open ground), a flat cut
 * (the island rim, a bridge or water), or at a junction (covered by its disc).
 */
export type RoadEnd = "cap" | "flat" | "junction";

export type RoadPoint = { x: number; y: number; z: number };

export type RoadPath = {
  points: RoadPoint[];
  start: RoadEnd;
  end: RoadEnd;
  /** A loop: the last point joins the first. */
  closed: boolean;
};

export type RoadJunction = RoadPoint & { q: number; r: number; arms: number };

export type RoadNetwork = {
  islandId: string;
  width: number;
  paths: RoadPath[];
  junctions: RoadJunction[];
  /** Plan-view segments of every path (for distance queries), flattened [ax, az, bx, bz]. */
  segments: number[];
};

export type RoadOptions = {
  width?: number;
  /** Resampling step along the centre line (metres). */
  step?: number;
  /** Chaikin corner-cutting iterations. */
  smoothing?: number;
  /** Island heightJitter amplitude (the grass skin's lift), so the road follows it. */
  heightJitter?: number;
};

type Stub = { kind: "link"; to: string } | { kind: "end"; end: RoadEnd };

type RoadNode = {
  key: string;
  cell: WalkCell;
  arms: Map<number, Stub>;
};

function edgeMidpoint(cell: WalkCell, dir: number, hexWidth: number): Point2 {
  const a = (dir * 60 * Math.PI) / 180;
  return {
    x: cell.x + Math.cos(a) * (hexWidth / 2),
    z: cell.z - Math.sin(a) * (hexWidth / 2),
  };
}

/** Road hexes of the island and their arms, with each arm linked or ended. */
export function roadNodes(
  island: {
    hexes: readonly { q: number; r: number; tile: string; rot?: number }[];
  },
  grid: IslandWalkGrid
): Map<string, RoadNode> {
  const nodes = new Map<string, RoadNode>();
  const armsOf = new Map<string, number[]>();
  for (const hex of island.hexes) {
    if (!isRoadTile(hex.tile)) continue;
    const key = hexKey(hex.q, hex.r);
    const cell = grid.cells.get(key);
    if (!cell) continue;
    armsOf.set(key, roadArms(hex.tile, hex.rot ?? 0) ?? []);
    nodes.set(key, { key, cell, arms: new Map() });
  }
  // Unknown road tiles connect to every neighbouring road hex.
  for (const [key, arms] of armsOf) {
    if (arms.length > 0) continue;
    const { cell } = nodes.get(key) as RoadNode;
    HEX_DIRECTIONS.forEach((d, k) => {
      if (armsOf.has(hexKey(cell.q + d.q, cell.r + d.r))) arms.push(k);
    });
  }
  for (const node of nodes.values()) {
    const { cell } = node;
    for (const k of armsOf.get(node.key) ?? []) {
      const d = HEX_DIRECTIONS[k] as { q: number; r: number };
      const nKey = hexKey(cell.q + d.q, cell.r + d.r);
      const back = armsOf.get(nKey);
      if (back && back.includes((k + 3) % 6)) {
        node.arms.set(k, { kind: "link", to: nKey });
        continue;
      }
      const n = grid.cells.get(nKey);
      // Off the island, into water or onto a bridge deck: cut flat at the edge.
      const flat = !n || n.deck || n.water || !n.ground;
      node.arms.set(k, { kind: "end", end: flat ? "flat" : "cap" });
    }
  }
  return nodes;
}

/** Chaikin corner cutting; open curves keep their end points. */
export function chaikin(
  pts: readonly Point2[],
  iterations: number,
  closed: boolean
): Point2[] {
  let cur = pts.slice();
  for (let it = 0; it < iterations; it++) {
    if (cur.length < 3) return cur;
    const next: Point2[] = [];
    const n = cur.length;
    if (!closed) next.push(cur[0] as Point2);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = cur[i] as Point2;
      const b = cur[(i + 1) % n] as Point2;
      const q = { x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 };
      const r = { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 };
      if (!closed && i === 0) next.push(r);
      else if (!closed && i === segs - 1) next.push(q);
      else next.push(q, r);
    }
    if (!closed) next.push(cur[n - 1] as Point2);
    cur = next;
  }
  return cur;
}

/** Evenly spaced points along a polyline (end points kept). */
export function resample(
  pts: readonly Point2[],
  step: number,
  closed: boolean
): Point2[] {
  const src = closed && pts.length > 1 ? [...pts, pts[0] as Point2] : pts;
  if (src.length < 2) return src.slice();
  const lens: number[] = [0];
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1] as Point2;
    const b = src[i] as Point2;
    lens.push((lens[i - 1] as number) + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const total = lens[lens.length - 1] as number;
  const n = Math.max(1, Math.round(total / step));
  const out: Point2[] = [];
  let j = 1;
  const last = closed ? n - 1 : n;
  for (let i = 0; i <= last; i++) {
    const s = (i / n) * total;
    while (j < src.length - 1 && (lens[j] as number) < s) j++;
    const a = src[j - 1] as Point2;
    const b = src[j] as Point2;
    const l0 = lens[j - 1] as number;
    const l1 = lens[j] as number;
    const t = l1 > l0 ? (s - l0) / (l1 - l0) : 0;
    out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  return out;
}

/**
 * Surface height for road geometry at (x, z), using the cell under the reference point
 * (rx, rz) on the centre line: slopes use the walk grid's slope profile, flat cells their
 * tile top plus the skin's height jitter. A vertex over a neighbouring cell of (almost)
 * the same height follows that cell; next to a step it keeps the centre line's surface
 * (hidden under a higher neighbour, a slight lip over a lower one), so road edges never
 * climb or drape over terrace walls.
 */
export function roadHeightAt(
  grid: IslandWalkGrid,
  heightJitter: number,
  x: number,
  z: number,
  rx = x,
  rz = z
): number {
  const surface = (cell: WalkCell): number => {
    if (cell.slope) return cellHeightAt(cell, x, z, grid.hexWidth);
    if (cell.deck || cell.water) return cell.y;
    return (
      grid.baseY +
      cell.level * grid.levelHeight +
      groundLift(x, z, heightJitter)
    );
  };
  const ref = cellAtWorld(grid, rx, rz) ?? cellAtWorld(grid, x, z);
  if (!ref) return grid.baseY;
  const base = surface(ref);
  const own = cellAtWorld(grid, x, z);
  if (!own || own === ref || own.water || !own.ground) return base;
  const h = surface(own);
  return Math.abs(h - base) < 0.05 ? h : base;
}

/** True when a road vertex at (x, z) may be drawn: over island ground (or a deck), not void or open water. */
export function roadCanCover(
  grid: IslandWalkGrid,
  x: number,
  z: number
): boolean {
  const c = cellAtWorld(grid, x, z);
  return Boolean(c && (c.deck || !c.water));
}

/**
 * Build the island's road network: centre lines through hex centres and shared edge
 * midpoints, smoothed and resampled, with y following the terrain (ramps included).
 */
export function buildRoadNetwork(
  island: {
    id: string;
    hexes: readonly { q: number; r: number; tile: string; rot?: number }[];
  },
  grid: IslandWalkGrid,
  opts: RoadOptions = {}
): RoadNetwork {
  const width = opts.width ?? ROAD_WIDTH;
  const step = opts.step ?? 0.3;
  const smoothing = opts.smoothing ?? 3;
  const jitter = opts.heightJitter ?? 0;
  const nodes = roadNodes(island, grid);
  const used = new Set<string>();
  const edgeId = (key: string, dir: number): string => `${key}#${dir}`;
  const terminal = (n: RoadNode): boolean => n.arms.size !== 2;
  const endOf = (n: RoadNode): RoadEnd =>
    n.arms.size >= 3 ? "junction" : "cap";
  const hw = grid.hexWidth;

  type Walk = { pts: Point2[]; end: RoadEnd; endKey: string | null };
  /** Follow the road from `start` out through arm `dir` until a terminal or a stub end. */
  const walk = (start: RoadNode, dir: number): Walk => {
    const pts: Point2[] = [];
    let cur = start;
    let d = dir;
    for (let guard = 0; guard < 10000; guard++) {
      used.add(edgeId(cur.key, d));
      const stub = cur.arms.get(d) as Stub;
      const mid = edgeMidpoint(cur.cell, d, hw);
      if (stub.kind === "end") {
        if (stub.end === "cap") {
          // Stop a little short of the edge so the cap only just spills over.
          const a = (d * 60 * Math.PI) / 180;
          pts.push({
            x: mid.x - Math.cos(a) * width * 0.25,
            z: mid.z + Math.sin(a) * width * 0.25,
          });
        } else pts.push(mid);
        return { pts, end: stub.end, endKey: null };
      }
      pts.push(mid);
      const next = nodes.get(stub.to) as RoadNode;
      const back = (d + 3) % 6;
      used.add(edgeId(next.key, back));
      pts.push({ x: next.cell.x, z: next.cell.z });
      if (terminal(next) || next === start)
        return {
          pts,
          end: next === start ? "junction" : endOf(next),
          endKey: next.key,
        };
      const out = [...next.arms.keys()].find((k) => k !== back);
      if (out === undefined) return { pts, end: "cap", endKey: next.key };
      cur = next;
      d = out;
    }
    return { pts, end: "cap", endKey: null };
  };

  const raw: {
    pts: Point2[];
    start: RoadEnd;
    end: RoadEnd;
    closed: boolean;
  }[] = [];
  const sorted = [...nodes.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const n of sorted) {
    if (!terminal(n)) continue;
    if (n.arms.size === 0) {
      // A lone road hex with no arms: a short round blob.
      raw.push({
        pts: [
          { x: n.cell.x - 0.01, z: n.cell.z },
          { x: n.cell.x + 0.01, z: n.cell.z },
        ],
        start: "cap",
        end: "cap",
        closed: false,
      });
      continue;
    }
    for (const d of [...n.arms.keys()].sort((a, b) => a - b)) {
      if (used.has(edgeId(n.key, d))) continue;
      const w = walk(n, d);
      raw.push({
        pts: [{ x: n.cell.x, z: n.cell.z }, ...w.pts],
        start: endOf(n),
        end: w.end,
        closed: false,
      });
    }
  }
  // What is left runs through two-armed hexes only: open chains between stubs, or loops.
  for (const n of sorted) {
    const arms = [...n.arms.keys()].sort((a, b) => a - b);
    if (arms.length !== 2 || used.has(edgeId(n.key, arms[0] as number)))
      continue;
    const a = walk(n, arms[0] as number);
    if (a.endKey === n.key) {
      raw.push({
        pts: [{ x: n.cell.x, z: n.cell.z }, ...a.pts.slice(0, -1)],
        start: "cap",
        end: "cap",
        closed: true,
      });
      continue;
    }
    const b = walk(n, arms[1] as number);
    raw.push({
      pts: [...b.pts.slice().reverse(), { x: n.cell.x, z: n.cell.z }, ...a.pts],
      start: b.end,
      end: a.end,
      closed: false,
    });
  }

  const paths: RoadPath[] = [];
  const segments: number[] = [];
  for (const r of raw) {
    const smooth = resample(
      chaikin(r.pts, smoothing, r.closed),
      step,
      r.closed
    );
    const points = smooth.map((p) => ({
      x: p.x,
      y: roadHeightAt(grid, jitter, p.x, p.z),
      z: p.z,
    }));
    paths.push({ points, start: r.start, end: r.end, closed: r.closed });
    const m = smooth.length;
    const segs = r.closed ? m : m - 1;
    for (let i = 0; i < segs; i++) {
      const a = smooth[i] as Point2;
      const b = smooth[(i + 1) % m] as Point2;
      segments.push(a.x, a.z, b.x, b.z);
    }
    if (m === 1) {
      const a = smooth[0] as Point2;
      segments.push(a.x, a.z, a.x, a.z);
    }
  }
  const junctions: RoadJunction[] = sorted
    .filter((n) => n.arms.size >= 3)
    .map((n) => ({
      x: n.cell.x,
      y: roadHeightAt(grid, jitter, n.cell.x, n.cell.z),
      z: n.cell.z,
      q: n.cell.q,
      r: n.cell.r,
      arms: n.arms.size,
    }));
  return { islandId: island.id, width, paths, junctions, segments };
}

/** Plan-view distance from (x, z) to the nearest road centre line (Infinity without roads). */
export function distanceToRoad(net: RoadNetwork, x: number, z: number): number {
  let best = Infinity;
  const s = net.segments;
  for (let i = 0; i < s.length; i += 4) {
    const ax = s[i] as number;
    const az = s[i + 1] as number;
    const dx = (s[i + 2] as number) - ax;
    const dz = (s[i + 3] as number) - az;
    const l2 = dx * dx + dz * dz;
    const t =
      l2 > 0
        ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2))
        : 0;
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) best = d;
  }
  return best;
}

/** True when (x, z) lies on a road ribbon (within half the road width, plus a margin). */
export function onRoad(
  net: RoadNetwork,
  x: number,
  z: number,
  margin = 0
): boolean {
  return distanceToRoad(net, x, z) <= net.width / 2 + margin;
}
