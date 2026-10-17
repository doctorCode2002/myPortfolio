/**
 * Pointy-top axial hex math (q, r), Three-free and React-free.
 *
 * Conventions (see docs/WORLD_3D_SPEC.md):
 * - World axes: x to the east, z to the south (Three.js default, so "north" is -z), y up.
 * - `size` is the hex circumradius R (centre to corner). A pointy-top hex is
 *   sqrt(3) * R wide across its flats (along x) and 2R tall corner to corner (along z).
 * - The manifest's `hexSize` is the tile width across flats, measured on the glb's x
 *   extent; convert it with `circumradiusFromWidth`.
 */

export type Axial = { q: number; r: number };
export type Point2 = { x: number; z: number };

export const SQRT3 = Math.sqrt(3);

/** Default tile width across flats (KayKit Medieval Hexagon tiles are 2 units wide). */
export const DEFAULT_HEX_WIDTH = 2;

export function circumradiusFromWidth(width: number): number {
  return width / SQRT3;
}

export function widthFromCircumradius(size: number): number {
  return size * SQRT3;
}

/** The six axial neighbour directions, starting east and going clockwise seen from above (+y). */
export const HEX_DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function parseHexKey(key: string): Axial {
  const [q, r] = key.split(",").map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

export function hexAdd(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexScale(a: Axial, k: number): Axial {
  return { q: a.q * k, r: a.r * k };
}

/** Centre of hex (q, r) in local world units for a hex of circumradius `size`. */
export function hexToWorld(q: number, r: number, size: number): Point2 {
  return {
    x: size * SQRT3 * (q + r / 2),
    z: size * 1.5 * r,
  };
}

/** Fractional axial coordinates of a local world point. */
export function worldToFractionalHex(
  x: number,
  z: number,
  size: number
): Axial {
  const q = ((SQRT3 / 3) * x - (1 / 3) * z) / size;
  const r = ((2 / 3) * z) / size;
  return { q, r };
}

/** Cube rounding of fractional axial coordinates to the containing hex. */
export function hexRound(q: number, r: number): Axial {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // Normalise -0 to 0 so keys are stable.
  return { q: rq + 0, r: rr + 0 };
}

/** The hex containing a local world point. */
export function worldToHex(x: number, z: number, size: number): Axial {
  const f = worldToFractionalHex(x, z, size);
  return hexRound(f.q, f.r);
}

export function hexNeighbours(q: number, r: number): Axial[] {
  return HEX_DIRECTIONS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

export function hexDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** All hexes exactly `radius` steps from `center` (a single hex for radius 0). */
export function hexRing(center: Axial, radius: number): Axial[] {
  if (radius <= 0) return [{ q: center.q, r: center.r }];
  const results: Axial[] = [];
  // Start at the hex `radius` steps in direction 4 and walk the six sides.
  const start = HEX_DIRECTIONS[4] as Axial;
  let cur = hexAdd(center, hexScale(start, radius));
  for (let side = 0; side < 6; side++) {
    const dir = HEX_DIRECTIONS[side] as Axial;
    for (let step = 0; step < radius; step++) {
      results.push(cur);
      cur = hexAdd(cur, dir);
    }
  }
  return results;
}

/** All hexes within `radius` of `center`, ring by ring from the centre. */
export function hexSpiral(center: Axial, radius: number): Axial[] {
  const out: Axial[] = [];
  for (let k = 0; k <= radius; k++) out.push(...hexRing(center, k));
  return out;
}

/** The six corners of a pointy-top hex (local), starting at the top-right corner (-30 degrees). */
export function hexCorners(q: number, r: number, size: number): Point2[] {
  const c = hexToWorld(q, r, size);
  const out: Point2[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    out.push({
      x: c.x + size * Math.cos(angle),
      z: c.z + size * Math.sin(angle),
    });
  }
  return out;
}

/** True when a local point lies inside hex (q, r). */
export function pointInHex(
  x: number,
  z: number,
  q: number,
  r: number,
  size: number
): boolean {
  const h = worldToHex(x, z, size);
  return h.q === q && h.r === r;
}
