/**
 * Circle-collider movement against the walk world, with sliding along edges and
 * obstacles. Pure: no three or react imports.
 */

import { obstacleDistance } from "./walk-grid";
import {
  obstaclesNear,
  surfaceAt,
  type Surface,
  type WalkWorld,
} from "./walk-world";

export type Body = { x: number; y: number; z: number };

const SAMPLE_DIRS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)] as const;
});

/**
 * Whether a circle of `radius` can stand at (x, z), coming from height `fromY`.
 * The centre needs a surface within one step of `fromY`, every rim sample needs a
 * surface within one step of the centre, and no obstacle may overlap the circle.
 */
export function canStand(
  world: WalkWorld,
  x: number,
  z: number,
  radius: number,
  fromY?: number
): Surface | null {
  const centre = surfaceAt(world, x, z, fromY);
  if (!centre) return null;
  if (fromY !== undefined && Math.abs(centre.y - fromY) > world.maxStep)
    return null;
  for (const [dx, dz] of SAMPLE_DIRS) {
    const s = surfaceAt(world, x + dx * radius, z + dz * radius, centre.y);
    if (!s || Math.abs(s.y - centre.y) > world.maxStep) return null;
  }
  for (const o of obstaclesNear(world, x, z, radius)) {
    if (obstacleDistance(o, x, z) < radius) return null;
  }
  return centre;
}

function rotate(dx: number, dz: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [dx * c - dz * s, dx * s + dz * c];
}

export type MoveResult = {
  x: number;
  y: number;
  z: number;
  surface: Surface | null;
  /** True when the full requested move was not possible. */
  blocked: boolean;
};

/**
 * Move a circle by (dx, dz), sliding along walls: if the direct step is blocked it tries
 * the step deflected by growing angles (shortened by the cosine, like a projection onto
 * the wall), then the two axis-aligned components. Long moves are sub-stepped so the
 * collider never tunnels through thin gaps.
 */
export function moveCircle(
  world: WalkWorld,
  body: Body,
  dx: number,
  dz: number,
  radius: number
): MoveResult {
  let x = body.x;
  let z = body.z;
  let y = body.y;
  let surface: Surface | null = surfaceAt(world, x, z, y);
  let blocked = false;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-9) return { x, y: surface?.y ?? y, z, surface, blocked };
  const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)));
  const sx = dx / steps;
  const sz = dz / steps;

  for (let i = 0; i < steps; i++) {
    const candidates: [number, number][] = [[sx, sz]];
    for (const deg of [30, 50, 70]) {
      const a = (deg * Math.PI) / 180;
      const k = Math.cos(a);
      const [ax, az] = rotate(sx, sz, a);
      const [bx, bz] = rotate(sx, sz, -a);
      candidates.push([ax * k, az * k], [bx * k, bz * k]);
    }
    candidates.push([sx, 0], [0, sz]);

    let moved = false;
    for (let c = 0; c < candidates.length; c++) {
      const [cx, cz] = candidates[c] as [number, number];
      if (Math.hypot(cx, cz) < 1e-6) continue;
      const s = canStand(world, x + cx, z + cz, radius, y);
      if (s) {
        if (c > 0) blocked = true;
        x += cx;
        z += cz;
        y = s.y;
        surface = s;
        moved = true;
        break;
      }
    }
    if (!moved) {
      blocked = true;
      break;
    }
  }
  return { x, y, z, surface, blocked };
}

/**
 * Find a standable point near (x, z): the point itself, or the first standable sample on
 * growing rings around it. Used to place spawns and to recover from bad positions.
 */
export function nearestStandable(
  world: WalkWorld,
  x: number,
  z: number,
  radius: number,
  maxRange = 4
): { x: number; z: number; surface: Surface } | null {
  const here = canStand(world, x, z, radius);
  if (here) return { x, z, surface: here };
  for (let ring = 0.25; ring <= maxRange; ring += 0.25) {
    const n = Math.max(8, Math.round(ring * 12));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * ring;
      const pz = z + Math.sin(a) * ring;
      const s = canStand(world, px, pz, radius);
      if (s) return { x: px, z: pz, surface: s };
    }
  }
  return null;
}
