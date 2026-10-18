/**
 * World positions of the exploration collectibles (sky shards, signal fires), the island
 * outlines and bridges for the minimap, and the compass bearing maths. Pure: no three or
 * react imports.
 */

import {
  SHARD_HEIGHT,
  SHARDS,
  SIGNAL_FIRES,
  type MetaSpot,
} from "@/lib/content/collectibles";
import { hexToWorld } from "../logic/hex";
import { islandHexToWorld } from "../logic/walk-grid";
import { surfaceAt } from "../logic/walk-world";
import type { GameWorld } from "../logic/world-layout";

export type Placed = {
  id: string;
  islandId: string;
  x: number;
  /** Ground height under the spot. */
  ground: number;
  /** Render height (ground plus hover for shards). */
  y: number;
  z: number;
};

function place(world: GameWorld, spot: MetaSpot, id: string, lift: number) {
  const island = world.islands.find((i) => i.id === spot.islandId);
  if (!island) return null;
  const c = islandHexToWorld(island, spot.q, spot.r, world.size);
  const x = c.x + (spot.offset?.[0] ?? 0);
  const z = c.z + (spot.offset?.[1] ?? 0);
  const grid = world.walk.islands.find((g) => g.islandId === spot.islandId);
  const cellY = grid?.cells.get(`${spot.q},${spot.r}`)?.y ?? island.baseY ?? 0;
  const ground = surfaceAt(world.walk, x, z, cellY)?.y ?? cellY;
  return { id, islandId: spot.islandId, x, ground, y: ground + lift, z };
}

export function placeShards(world: GameWorld): Placed[] {
  const out: Placed[] = [];
  for (const s of SHARDS) {
    const p = place(world, s, s.id, s.height ?? SHARD_HEIGHT);
    if (p) out.push(p);
  }
  return out;
}

export function placeFires(world: GameWorld): Placed[] {
  const out: Placed[] = [];
  for (const [islandId, spot] of Object.entries(SIGNAL_FIRES)) {
    const p = place(world, spot, islandId, 0);
    if (p) out.push(p);
  }
  return out;
}

/** Minimap data: one SVG path per island (its hex footprint), the bridges and the bounds. */
export type MapShape = {
  islandId: string;
  /** SVG path of every land hex (world x, z). */
  d: string;
  cx: number;
  cz: number;
};

export type MapData = {
  islands: MapShape[];
  bridges: { id: string; ax: number; az: number; bx: number; bz: number }[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function buildMapData(world: GameWorld): MapData {
  const islands: MapShape[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  // Pointy-top corners, scaled up a hair so neighbours overlap (no hairline seams).
  const s = world.size * 1.04;
  const corners: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    corners.push([Math.cos(a) * s, Math.sin(a) * s]);
  }
  for (const island of world.islands) {
    const parts: string[] = [];
    for (const h of island.hexes) {
      const p = hexToWorld(h.q, h.r, world.size);
      const x = island.center[0] + p.x;
      const z = island.center[1] + p.z;
      minX = Math.min(minX, x - s);
      maxX = Math.max(maxX, x + s);
      minZ = Math.min(minZ, z - s);
      maxZ = Math.max(maxZ, z + s);
      parts.push(
        "M" +
          corners
            .map(([cx, cz]) => `${(x + cx).toFixed(2)} ${(z + cz).toFixed(2)}`)
            .join("L") +
          "Z"
      );
    }
    islands.push({
      islandId: island.id,
      d: parts.join(""),
      cx: island.center[0],
      cz: island.center[1],
    });
  }
  const bridges = world.walk.bridges.map((b) => ({
    id: b.id,
    ax: b.a.x,
    az: b.a.z,
    bx: b.b.x,
    bz: b.b.z,
  }));
  return { islands, bridges, minX, maxX, minZ, maxZ };
}

/**
 * Bearing of a target relative to the camera's view (radians, 0 straight ahead, positive
 * to the right). The follow camera sits at +z of the player at yaw 0 and looks toward -z.
 */
export function relativeBearing(
  dx: number,
  dz: number,
  cameraYaw: number
): number {
  // Forward (fx, fz) and right (rx, rz) on the ground plane.
  const fx = -Math.sin(cameraYaw);
  const fz = -Math.cos(cameraYaw);
  const rx = Math.cos(cameraYaw);
  const rz = -Math.sin(cameraYaw);
  return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
}

/** The nearest point among `items` that `skip` does not exclude, or null. */
export function nearest<T extends { x: number; z: number }>(
  items: readonly T[],
  x: number,
  z: number,
  skip: (item: T) => boolean
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const it of items) {
    if (skip(it)) continue;
    const d = (it.x - x) ** 2 + (it.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best;
}
