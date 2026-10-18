/**
 * Ziplines: a cable from a post on one island down to a post on another, ridden hanging
 * from a pulley handle (E at the start post). The rider speeds up along the slope, eases
 * in at the far end and is set down on a standable spot there. Pure: no three or react
 * imports.
 */

import { canStand } from "./collision";
import { hexKey } from "./hex";
import type { Point3 } from "./jump-arc";
import type { Island3D } from "./types";
import type { WalkWorld } from "./walk-world";

/** The handle hangs this far below the cable, the rider's feet this far below the cable. */
export const ZIP_HANG = 0.25;
export const ZIP_FEET = 1.5;
export const ZIP_RANGE = 1.2;

export type Zipline = {
  id: string;
  islandId: string;
  toIslandId: string;
  /** Cable ends (tops of the posts). */
  a: Point3;
  b: Point3;
  /** Sag at mid-span (metres, downward). */
  sag: number;
  length: number;
  /** The start spot (ground at the start post), for prompts. */
  x: number;
  y: number;
  z: number;
  /** Ground spots at both posts: where the rider starts and is set down. */
  start: Point3;
  end: Point3;
};

export type ZipState = {
  line: Zipline;
  /** Position along the cable, 0..1. */
  t: number;
  /** Speed along the cable (m/s). */
  speed: number;
};

export const ZIP = {
  startSpeed: 1.5,
  maxSpeed: 9,
  /** Acceleration down the slope (plus a constant push, it is a gentle slope). */
  accel: 3.2,
  /** Eases in over the last metres. */
  brakeDist: 3.5,
  endSpeed: 1.6,
} as const;

/** Cable point at t (0..1), with the sag. */
export function cablePoint(line: Zipline, t: number, out: Point3): Point3 {
  const c = Math.min(1, Math.max(0, t));
  out.x = line.a.x + (line.b.x - line.a.x) * c;
  out.z = line.a.z + (line.b.z - line.a.z) * c;
  out.y = line.a.y + (line.b.y - line.a.y) * c - line.sag * 4 * c * (1 - c);
  return out;
}

/** Where the rider's feet are at t. */
export function riderPoint(line: Zipline, t: number, out: Point3): Point3 {
  cablePoint(line, t, out);
  out.y -= ZIP_FEET;
  return out;
}

/**
 * Build the ziplines of every island: post positions from the start and far hexes (the
 * far post is shorter so the cable runs downhill), the landing spots, the sag.
 */
export function buildZiplines(
  islands: readonly Island3D[],
  walk: WalkWorld
): Zipline[] {
  const out: Zipline[] = [];
  for (const island of islands) {
    for (const z of island.movement?.ziplines ?? []) {
      const ga = walk.islands.find((g) => g.islandId === island.id);
      const gb = walk.islands.find((g) => g.islandId === z.to.island);
      const ca = ga?.cells.get(hexKey(z.q, z.r));
      const cb = gb?.cells.get(hexKey(z.to.q, z.to.r));
      if (!ca || !cb) continue;
      const a = { x: ca.x, y: ca.y + (z.height ?? 4.2), z: ca.z };
      const b = { x: cb.x, y: cb.y + ZIP_FEET + 0.15, z: cb.z };
      const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      out.push({
        id: z.id,
        islandId: island.id,
        toIslandId: z.to.island,
        a,
        b,
        sag: Math.min(0.6, length * 0.012),
        x: ca.x,
        y: ca.y,
        z: ca.z,
        length,
        start: { x: ca.x, y: ca.y, z: ca.z },
        end: { x: cb.x, y: cb.y, z: cb.z },
      });
    }
  }
  return out;
}

/** Advance a ride by dt. Returns true when the rider has arrived (t = 1). */
export function stepZip(s: ZipState, dt: number): boolean {
  const { line } = s;
  const slope = (line.a.y - line.b.y) / Math.max(1, line.length);
  const left = (1 - s.t) * line.length;
  const cap =
    left < ZIP.brakeDist
      ? ZIP.endSpeed + (ZIP.maxSpeed - ZIP.endSpeed) * (left / ZIP.brakeDist)
      : ZIP.maxSpeed;
  s.speed = Math.min(cap, s.speed + (ZIP.accel + slope * 9.8) * dt);
  s.speed = Math.max(ZIP.endSpeed * 0.8, s.speed);
  s.t = Math.min(1, s.t + (s.speed * dt) / Math.max(1, line.length));
  return s.t >= 1;
}

/** Whether the far landing spot fits a walker of `radius`. */
export function zipLandingOk(
  walk: WalkWorld,
  line: Zipline,
  radius: number
): boolean {
  return canStand(walk, line.end.x, line.end.z, radius, line.end.y) !== null;
}
