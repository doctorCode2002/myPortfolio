import * as THREE from "three";

import {
  groundColor,
  srgbToLinear,
  type GroundPalette,
  type Rgb,
} from "../logic/ground";
import { valueNoise2 } from "../logic/noise";
import {
  roadCanCover,
  roadHeightAt,
  type RoadNetwork,
  type RoadPoint,
} from "../logic/roads";
import type { IslandWalkGrid } from "../logic/walk-grid";

/**
 * Wide road ribbons for one island, merged into one geometry: a lower "fringe" layer the
 * full road width (dark packed dirt fading out into the surrounding grass) and an upper
 * "core" layer a little narrower (warm sandy dirt with a slight crown and faceted
 * height noise, so flat shading reads as packed cobble). Overlapping ribbons at
 * junctions share world-space colours, so their union looks seamless; each path sits a
 * couple of millimetres above the previous one (no z-fighting) and junction discs and
 * round caps close the shapes. Vertices never hang over the void or open water.
 */

/** Heights above the walk surface (the grass skin is +0.012). */
const FRINGE_LIFT = 0.03;
const CORE_LIFT = 0.046;
/** Per-path offset so overlapping ribbons have a stable order. */
const PATH_STEP = 0.0018;
const PATH_LEVELS = 5;
/** Junction discs sit above every path of their layer. */
const DISC_LIFT = 0.011;
/** Core half width as a fraction of the road half width. */
const CORE_FRACTION = 0.86;

const DIRT = {
  light: srgbToLinear("#d9b682"),
  mid: srgbToLinear("#cba674"),
  dark: srgbToLinear("#b8915f"),
  edge: srgbToLinear("#9a7a4c"),
};

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Sandy packed dirt at a world point (a world-space field, so overlaps match). */
function dirtColor(x: number, z: number): Rgb {
  const broad = valueNoise2(x * 0.21, z * 0.21, 91);
  const fine = valueNoise2(x * 1.7, z * 1.7, 93);
  let c = mix(DIRT.mid, DIRT.light, broad);
  c = mix(c, DIRT.dark, Math.max(0, fine - 0.62) * 1.6);
  const k = 0.96 + valueNoise2(x * 3.1, z * 3.1, 97) * 0.07;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** The core's outer edge: dirt a little darker, so the core reads as slightly worn in. */
function rimColor(x: number, z: number): Rgb {
  const c = dirtColor(x, z);
  return [c[0] * 0.9, c[1] * 0.9, c[2] * 0.9];
}

function edgeColor(x: number, z: number): Rgb {
  return mix(DIRT.edge, dirtColor(x, z), 0.25);
}

/** The surrounding ground, a touch darker (trampled grass). */
function grassFringe(palette: GroundPalette, x: number, z: number): Rgb {
  const g = groundColor(palette, x, z);
  const c = mix(g, DIRT.edge, 0.18);
  return [c[0] * 0.95, c[1] * 0.95, c[2] * 0.95];
}

class Builder {
  pos: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  vertex(x: number, y: number, z: number, c: Rgb): number {
    this.pos.push(x, y, z);
    this.col.push(c[0], c[1], c[2]);
    return this.pos.length / 3 - 1;
  }
  /** Quad a-b-c-d (counter-clockwise seen from above when a, b run along the left). */
  quad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, b, c, a, c, d);
  }
  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }
}

export type RoadGeometryOptions = {
  palette: GroundPalette;
  heightJitter: number;
};

export function buildRoadGeometry(
  net: RoadNetwork,
  grid: IslandWalkGrid,
  opts: RoadGeometryOptions
): THREE.BufferGeometry | null {
  if (net.paths.length === 0) return null;
  const b = new Builder();
  const hw = net.width / 2;
  const height = (x: number, z: number, cx: number, cz: number): number =>
    roadHeightAt(grid, opts.heightJitter, x, z, cx, cz);
  /** The farthest offset (up to `s`) from c along (dx, dz) that stays over island ground. */
  const clampOffset = (
    c: RoadPoint,
    dx: number,
    dz: number,
    s: number
  ): number => {
    if (roadCanCover(grid, c.x + dx * s, c.z + dz * s)) return s;
    let lo = 0;
    let hi = s;
    for (let i = 0; i < 8; i++) {
      const m = (lo + hi) / 2;
      if (roadCanCover(grid, c.x + dx * m, c.z + dz * m)) lo = m;
      else hi = m;
    }
    return lo;
  };
  /** Wobble of the road edge (fraction of the half width) at a world point. */
  const wobble = (x: number, z: number, seed: number): number =>
    (valueNoise2(x * 0.9, z * 0.9, seed) - 0.5) * 0.09;
  const crown = (t: number, x: number, z: number): number => {
    // t in [-1, 1] across the core; a gentle crown plus faceted bumps inside.
    const inner = 1 - Math.abs(t);
    return (
      0.012 * inner +
      (inner > 0.01
        ? (valueNoise2(x * 2.3, z * 2.3, 99) - 0.5) * 0.012 * inner
        : 0)
    );
  };

  type Cross = { core: number[]; fringe: number[] };
  const CORE_T = [-1, -0.5, 0, 0.5, 1];

  /** One cross-section of both layers at a centre point with a unit normal (nx, nz). */
  const section = (
    p: RoadPoint,
    nx: number,
    nz: number,
    lift: number
  ): Cross => {
    const fw = hw * (1 + wobble(p.x, p.z, 101));
    const cw = hw * CORE_FRACTION * (1 + wobble(p.x, p.z, 103) * 1.4);
    const fringe: number[] = [];
    for (const [sgn, s, outer] of [
      [-1, fw, true],
      [-1, cw * 0.92, false],
      [1, cw * 0.92, false],
      [1, fw, true],
    ] as const) {
      const off = clampOffset(p, nx * sgn, nz * sgn, s);
      const x = p.x + nx * sgn * off;
      const z = p.z + nz * sgn * off;
      const y = height(x, z, p.x, p.z) + FRINGE_LIFT + lift;
      fringe.push(
        b.vertex(
          x,
          y,
          z,
          outer ? grassFringe(opts.palette, x, z) : edgeColor(x, z)
        )
      );
    }
    const core: number[] = [];
    for (const t of CORE_T) {
      const sgn = Math.sign(t) || 1;
      const off = clampOffset(p, nx * sgn, nz * sgn, Math.abs(t) * cw);
      const x = p.x + nx * sgn * off;
      const z = p.z + nz * sgn * off;
      const y = height(x, z, p.x, p.z) + CORE_LIFT + lift + crown(t, x, z);
      core.push(
        b.vertex(x, y, z, Math.abs(t) > 0.99 ? rimColor(x, z) : dirtColor(x, z))
      );
    }
    return { core, fringe };
  };

  /**
   * A round fan around c from angle a0 to a1 (radians, plan view, x = cos, z = sin):
   * fringe ring and core fan, with the given lift.
   */
  const fan = (c: RoadPoint, a0: number, a1: number, lift: number): void => {
    const segs = Math.max(3, Math.ceil(((a1 - a0) / Math.PI) * 9));
    const fw = hw * (1 + wobble(c.x, c.z, 101));
    const cw = hw * CORE_FRACTION * (1 + wobble(c.x, c.z, 103) * 1.4);
    const fc = b.vertex(
      c.x,
      height(c.x, c.z, c.x, c.z) + FRINGE_LIFT + lift,
      c.z,
      edgeColor(c.x, c.z)
    );
    const cc = b.vertex(
      c.x,
      height(c.x, c.z, c.x, c.z) + CORE_LIFT + lift + crown(0, c.x, c.z),
      c.z,
      dirtColor(c.x, c.z)
    );
    let prev: { fi: number; fo: number; co: number; cm: number } | null = null;
    for (let i = 0; i <= segs; i++) {
      const a = a0 + ((a1 - a0) * i) / segs;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const at = (
        s: number,
        l: number,
        colour: (x: number, z: number) => Rgb,
        t: number
      ): number => {
        const off = clampOffset(c, dx, dz, s);
        const x = c.x + dx * off;
        const z = c.z + dz * off;
        return b.vertex(
          x,
          height(x, z, c.x, c.z) + l + lift + (t >= 0 ? crown(t, x, z) : 0),
          z,
          colour(x, z)
        );
      };
      const cur = {
        fi: at(cw * 0.92, FRINGE_LIFT, edgeColor, -1),
        fo: at(fw, FRINGE_LIFT, (x, z) => grassFringe(opts.palette, x, z), -1),
        cm: at(cw * 0.5, CORE_LIFT, dirtColor, 0.5),
        co: at(cw, CORE_LIFT, rimColor, 1),
      };
      if (prev) {
        // Winding: angles grow from +x towards +z, i.e. clockwise seen from above.
        b.tri(fc, cur.fi, prev.fi);
        b.quad(prev.fi, cur.fi, cur.fo, prev.fo);
        b.tri(cc, cur.cm, prev.cm);
        b.quad(prev.cm, cur.cm, cur.co, prev.co);
      }
      prev = cur;
    }
  };

  net.paths.forEach((path, pi) => {
    const pts = path.points;
    const n = pts.length;
    if (n === 0) return;
    const lift = (pi % PATH_LEVELS) * PATH_STEP;
    const tangent = (i: number): [number, number] => {
      const a = path.closed ? pts[(i - 1 + n) % n]! : pts[Math.max(0, i - 1)]!;
      const c = path.closed ? pts[(i + 1) % n]! : pts[Math.min(n - 1, i + 1)]!;
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l];
    };
    const sections: Cross[] = [];
    for (let i = 0; i < n; i++) {
      const [tx, tz] = tangent(i);
      // Left normal (seen from above with x east, z south): (tz, -tx).
      sections.push(section(pts[i]!, tz, -tx, lift));
    }
    const segs = path.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const s0 = sections[i]!;
      const s1 = sections[(i + 1) % n]!;
      for (let k = 0; k < 3; k++)
        b.quad(
          s0.fringe[k]!,
          s1.fringe[k]!,
          s1.fringe[k + 1]!,
          s0.fringe[k + 1]!
        );
      for (let k = 0; k < CORE_T.length - 1; k++)
        b.quad(s0.core[k]!, s1.core[k]!, s1.core[k + 1]!, s0.core[k + 1]!);
    }
    if (path.closed) return;
    // Round caps at dead ends: a half disc beyond the end, facing outward.
    const capAt = (i: number, outward: number): void => {
      const [tx, tz] = tangent(i);
      const a = Math.atan2(tz * outward, tx * outward);
      fan(pts[i]!, a - Math.PI / 2, a + Math.PI / 2, lift);
    };
    if (path.start === "cap") capAt(0, -1);
    if (path.end === "cap") capAt(n - 1, 1);
  });
  for (const j of net.junctions) fan(j, 0, Math.PI * 2, DISC_LIFT);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
  g.setIndex(b.idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
