/**
 * Procedural models for the WACO island (an industrial and engineering consultancy in
 * Riyadh): the consultancy headquarters (the portal building), two small factory blocks
 * with chimneys, twin silos, storage tanks, pipe runs, stacked containers, blueprint
 * tables, a feasibility-study drafting pavilion, a survey tripod, modern street lamps, an
 * entrance monolith, a shaded bench and stone planters. Colours come from the WACO brand
 * palette (#58595b, #7ca4ae, #4790a5, #2a7687). Also the workshop-island billboard of
 * Teryaq (an in-progress project): Teryaq green (#408a71, #f5f5f5, #b2ddc9) with a
 * heartbeat pulse line, never a medical cross or plus sign. Small flat-shaded low-poly glbs with
 * vertex colours, written to public/game3d/models/w-<name>.glb and registered in
 * public/game3d/models/custom-waco.json (a manifest fragment).
 *
 *   node scripts/3d/procedural/waco.mjs
 *
 * Every model is CC0 (our own geometry). No cross shapes anywhere: windows are horizontal
 * ribbons (no mullion grids), ladders are rails with rungs that end at them, the pipe
 * supports are T joints, the valve wheel is a solid disc, the tripod legs meet only at
 * the head, and ruled lines on the blueprints run parallel without crossing.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { Document, Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { quantize } from "@gltf-transform/functions";

const OUT_DIR = path.resolve(
  import.meta.dirname,
  "../../../public/game3d/models"
);
const FRAGMENT = path.join(OUT_DIR, "custom-waco.json");

// ---------------------------------------------------------------- affine maths
// A transform is 12 numbers, row-major 3x4: [a b c tx, d e f ty, g h i tz].
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
function mul(A, B) {
  const o = new Array(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += A[r * 4 + k] * B[k * 4 + c];
      if (c === 3) s += A[r * 4 + 3];
      o[r * 4 + c] = s;
    }
  }
  return o;
}
const chain = (...ms) => ms.reduce((a, b) => mul(a, b), I);
const T = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
const S = (x, y = x, z = x) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0];
const Ry = (deg) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0];
};
const Rx = (deg) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
};
const Rz = (deg) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0];
};
function apply(m, p) {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
    m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
    m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
  ];
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// ---------------------------------------------------------------- colours
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function hex(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    srgbToLinear(v / 255)
  );
}

// ---------------------------------------------------------------- mesh builder
/** Collects flat-shaded triangles in up to three material groups. */
class Builder {
  constructor() {
    this.groups = { base: [], glass: [], glow: [] };
  }
  /** Add a convex solid: points (local) and faces (index lists), transformed by m. */
  convex(m, points, faces, color, group = "base") {
    const P = points.map((p) => apply(m, p));
    const centroid = P.reduce(
      (a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]],
      [0, 0, 0]
    ).map((v) => v / P.length);
    const rgb = typeof color === "string" ? hex(color) : color;
    for (const f of faces) {
      for (let i = 1; i < f.length - 1; i++) {
        let a = P[f[0]];
        let b = P[f[i]];
        let c = P[f[i + 1]];
        let n = cross(sub(b, a), sub(c, a));
        const mid = [
          (a[0] + b[0] + c[0]) / 3 - centroid[0],
          (a[1] + b[1] + c[1]) / 3 - centroid[1],
          (a[2] + b[2] + c[2]) / 3 - centroid[2],
        ];
        if (dot(n, mid) < 0) {
          [b, c] = [c, b];
          n = [-n[0], -n[1], -n[2]];
        }
        if (Math.hypot(n[0], n[1], n[2]) < 1e-12) continue;
        this.groups[group].push({ a, b, c, n: norm(n), rgb });
      }
    }
    return this;
  }
  /** Unit cube centred on the origin, transformed by m. */
  box(m, color, group) {
    const p = [];
    for (const x of [-0.5, 0.5])
      for (const y of [-0.5, 0.5])
        for (const z of [-0.5, 0.5]) p.push([x, y, z]);
    // index = xi*4 + yi*2 + zi
    const faces = [
      [0, 1, 3, 2],
      [4, 6, 7, 5],
      [0, 4, 5, 1],
      [2, 3, 7, 6],
      [0, 2, 6, 4],
      [1, 5, 7, 3],
    ];
    return this.convex(m, p, faces, color, group);
  }
  /** Axis-aligned box from min/max corners (after an optional outer transform). */
  aabb(x0, y0, z0, x1, y1, z1, color, group, outer = I) {
    return this.box(
      chain(
        outer,
        T((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
        S(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))
      ),
      color,
      group
    );
  }
  /** Cylinder (or cone/frustum) of radius 1 from y=0 to y=1, transformed by m. */
  cyl(m, seg, color, top = 1, group) {
    const p = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      p.push([Math.cos(a), 0, Math.sin(a)]);
    }
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      p.push([Math.cos(a) * top, 1, Math.sin(a) * top]);
    }
    const faces = [];
    if (top > 0) {
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        faces.push([i, j, seg + j, seg + i]);
      }
      faces.push([...Array(seg).keys()]);
      faces.push([...Array(seg).keys()].map((i) => seg + i));
    } else {
      p.length = seg;
      p.push([0, 1, 0]);
      for (let i = 0; i < seg; i++) faces.push([i, (i + 1) % seg, seg]);
      faces.push([...Array(seg).keys()]);
    }
    return this.convex(m, p, faces, color, group);
  }
  /** Triangular prism: triangle (-0.5,0) (0.5,0) (apex,1) in x/y, extruded z -0.5..0.5. */
  prism(m, color, group, apex = 0) {
    const p = [
      [-0.5, 0, -0.5],
      [0.5, 0, -0.5],
      [apex, 1, -0.5],
      [-0.5, 0, 0.5],
      [0.5, 0, 0.5],
      [apex, 1, 0.5],
    ];
    const faces = [
      [0, 1, 2],
      [3, 4, 5],
      [0, 1, 4, 3],
      [1, 2, 5, 4],
      [2, 0, 3, 5],
    ];
    return this.convex(m, p, faces, color, group);
  }
  /** Icosahedron of radius 1, transformed by m. */
  ico(m, color, group) {
    const t = (1 + Math.sqrt(5)) / 2;
    const v = [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ].map((p) => norm(p));
    const f = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ];
    return this.convex(m, v, f, color, group);
  }
  /** A square beam of thickness t (and depth d) from p0 to p1. */
  beam(p0, p1, t, color, d = t, group) {
    const axis = sub(p1, p0);
    const len = Math.hypot(axis[0], axis[1], axis[2]);
    const y = norm(axis);
    const ref = Math.abs(y[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const z = norm(cross(ref, y));
    const x = cross(y, z);
    const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2];
    const m = [
      x[0] * t,
      y[0] * len,
      z[0] * d,
      mid[0],
      x[1] * t,
      y[1] * len,
      z[1] * d,
      mid[1],
      x[2] * t,
      y[2] * len,
      z[2] * d,
      mid[2],
    ];
    return this.box(m, color, group);
  }
  /** Flat disc facing +z (a thin cylinder), centre (x, y, z). */
  disc(outer, x, y, z, r, thick, color, seg = 12, group) {
    return this.cyl(
      chain(outer, T(x, y, z), Rx(90), S(r, thick, r)),
      seg,
      color,
      1,
      group
    );
  }
}

// ---------------------------------------------------------------- palette
// The WACO brand palette (_brand/colors.txt in the WACO repo): grey, light teal, steel blue, deep teal.
const BRAND_GREY = "#58595b";
const BRAND_MIST = "#7ca4ae";
const BRAND_STEEL = "#4790a5";
const BRAND_TEAL = "#2a7687";
const WHITE = "#eef2f2";
const OFFWHITE = "#dfe4e3";
const CONCRETE = "#c9c3b6";
const CONCRETE_DARK = "#a59f92";
const STONE = "#d9c8a4";
const STONE_DARK = "#bba982";
const STEEL = "#8d969c";
const STEEL_DARK = "#4b5359";
const GLASS = "#9fd3e6";
const PAPER_BLUE = "#2f6aa3";
const PAPER_LINE = "#d8e8f5";
const WOOD = "#a9774b";
const WARM_LIGHT = "#ffd99a";

// ---------------------------------------------------------------- helpers
/** Horizontal ribbon windows on one face of a box (no mullions: bands only, so no grids). */
function ribbons(b, x0, x1, y0, y1, z, rows, face = 1) {
  const h = (y1 - y0) / rows;
  for (let i = 0; i < rows; i++) {
    const a = y0 + i * h + h * 0.28;
    const c = y0 + i * h + h * 0.8;
    b.aabb(x0, a, z, x1, c, z + 0.02 * face, GLASS, "glass");
  }
}

// ---------------------------------------------------------------- headquarters
/**
 * The consultancy HQ (the portal building, door towards +z): a steel-blue tower with
 * ribbon windows, a lower deep-teal wing, a white roof slab with a slanted teal fin, and
 * a white entrance canopy on two slim posts. Glass is banded, never gridded.
 */
function hq() {
  const b = new Builder();
  b.aabb(-0.98, 0, -0.86, 0.98, 0.12, 0.88, CONCRETE);
  b.aabb(-0.92, 0.12, -0.8, 0.92, 0.16, 0.82, OFFWHITE);
  // Tower.
  b.aabb(-0.78, 0.16, -0.66, 0.3, 3.55, 0.5, BRAND_STEEL);
  ribbons(b, -0.7, 0.22, 1.1, 3.4, 0.5, 5);
  // Side windows on the tower (on -x).
  for (let i = 0; i < 5; i++) {
    const y = 1.1 + i * 0.46;
    b.aabb(-0.8, y + 0.13, -0.5, -0.78, y + 0.37, 0.34, GLASS, "glass");
  }
  // A light-teal crown band and the roof slab with its fin.
  b.aabb(-0.8, 3.38, -0.68, 0.32, 3.48, 0.52, BRAND_MIST);
  b.aabb(-0.86, 3.55, -0.74, 0.38, 3.64, 0.58, WHITE);
  b.prism(
    chain(T(-0.2, 3.64, -0.08), Ry(90), S(1.0, 0.42, 0.12)),
    BRAND_TEAL,
    "base",
    0.5
  );
  // Lower wing (deep teal) with a glass band and a roof terrace rail.
  b.aabb(0.3, 0.16, -0.56, 0.9, 1.5, 0.46, BRAND_TEAL);
  ribbons(b, 0.36, 0.84, 0.75, 1.42, 0.46, 1);
  b.aabb(0.28, 1.5, -0.58, 0.92, 1.56, 0.48, WHITE);
  b.aabb(0.88, 1.56, -0.56, 0.9, 1.72, 0.46, STEEL);
  b.aabb(0.3, 1.56, 0.44, 0.9, 1.72, 0.46, STEEL);
  // Ground floor lobby glass and the entrance canopy.
  b.aabb(-0.66, 0.16, 0.5, 0.18, 0.9, 0.52, GLASS, "glass");
  b.aabb(-0.32, 0.16, 0.52, -0.12, 0.82, 0.53, STEEL_DARK);
  b.aabb(-0.6, 0.94, 0.48, 0.14, 1.0, 0.86, WHITE);
  for (const x of [-0.55, 0.09])
    b.aabb(x - 0.02, 0.16, 0.8, x + 0.02, 0.94, 0.84, STEEL);
  // Warm lobby light and a slim steel-blue name plinth (no lettering).
  b.aabb(-0.6, 0.86, 0.5, 0.12, 0.9, 0.51, WARM_LIGHT, "glow");
  b.aabb(0.42, 0.16, 0.6, 0.86, 0.42, 0.7, BRAND_GREY);
  b.aabb(0.46, 0.34, 0.7, 0.82, 0.38, 0.71, BRAND_MIST);
  return b;
}

// ---------------------------------------------------------------- industry
/** A small factory block with a saw-tooth roof (glazed north lights) and a tall chimney. */
function factory(wall, roof) {
  return () => {
    const b = new Builder();
    b.aabb(-0.85, 0, -0.6, 0.85, 0.08, 0.6, CONCRETE_DARK);
    b.aabb(-0.8, 0.08, -0.55, 0.8, 0.95, 0.55, wall);
    // Saw-tooth roof: three right-angled teeth along x, the steep faces glazed.
    const n = 3;
    const w = 1.6 / n;
    for (let i = 0; i < n; i++) {
      const cx = -0.8 + w * (i + 0.5);
      b.prism(chain(T(cx, 0.95, 0), S(w, 0.32, 1.1)), roof, "base", 0.5);
      b.aabb(
        cx + w / 2 - 0.015,
        0.99,
        -0.5,
        cx + w / 2,
        1.24,
        0.5,
        GLASS,
        "glass"
      );
    }
    // Roll-up door and a window band on the front (+z).
    b.aabb(-0.55, 0.08, 0.55, -0.1, 0.7, 0.57, BRAND_GREY);
    for (let y = 0.16; y < 0.66; y += 0.1)
      b.aabb(-0.55, y, 0.57, -0.1, y + 0.012, 0.575, STEEL_DARK);
    b.aabb(0.05, 0.5, 0.55, 0.72, 0.72, 0.57, GLASS, "glass");
    b.aabb(0.05, 0.42, 0.55, 0.72, 0.46, 0.575, WARM_LIGHT, "glow");
    // Chimney with two bands at the back corner.
    b.cyl(chain(T(0.55, 0.95, -0.32), S(0.13, 1.45, 0.13)), 12, OFFWHITE);
    b.cyl(chain(T(0.55, 2.0, -0.32), S(0.135, 0.12, 0.135)), 12, BRAND_TEAL);
    b.cyl(chain(T(0.55, 2.28, -0.32), S(0.135, 0.12, 0.135)), 12, BRAND_TEAL);
    b.cyl(chain(T(0.55, 2.4, -0.32), S(0.15, 0.04, 0.15)), 12, STEEL_DARK);
    return b;
  };
}

/** Twin grain/cement silos with cone tops, joined by a catwalk; a ladder of rails and rungs. */
function silos() {
  const b = new Builder();
  b.aabb(-0.7, 0, -0.36, 0.7, 0.08, 0.36, CONCRETE_DARK);
  for (const x of [-0.34, 0.34]) {
    b.cyl(chain(T(x, 0.08, 0), S(0.3, 0.32, 0.3)), 14, CONCRETE);
    b.cyl(chain(T(x, 0.4, 0), S(0.3, 1.5, 0.3)), 14, OFFWHITE);
    b.cyl(chain(T(x, 1.2, 0), S(0.305, 0.08, 0.305)), 14, BRAND_STEEL);
    b.cyl(chain(T(x, 1.9, 0), S(0.3, 0.3, 0.3)), 14, BRAND_MIST, 0.15);
  }
  // Catwalk bridging the tops (rests on both cones' rims).
  b.aabb(-0.36, 2.0, -0.08, 0.36, 2.04, 0.08, STEEL_DARK);
  b.aabb(-0.36, 2.04, 0.07, 0.36, 2.16, 0.08, STEEL);
  // Ladder on the front of the right silo: two rails, rungs ending at them.
  for (const x of [0.28, 0.42])
    b.aabb(x - 0.012, 0.4, 0.3, x + 0.012, 1.95, 0.32, STEEL_DARK);
  for (let y = 0.5; y < 1.9; y += 0.16)
    b.aabb(0.292, y, 0.305, 0.408, y + 0.018, 0.315, STEEL);
  return b;
}

/** A horizontal storage tank on two concrete saddles, white with a teal band. */
function tankLying() {
  const b = new Builder();
  for (const x of [-0.42, 0.42])
    b.aabb(x - 0.08, 0, -0.3, x + 0.08, 0.22, 0.3, CONCRETE);
  b.cyl(chain(T(-0.68, 0.48, 0), Rz(-90), S(0.3, 1.36, 0.3)), 14, WHITE);
  b.cyl(chain(T(-0.1, 0.48, 0), Rz(-90), S(0.305, 0.2, 0.305)), 14, BRAND_TEAL);
  for (const x of [-0.76, 0.68])
    b.cyl(chain(T(x, 0.48, 0), Rz(-90), S(0.22, 0.08, 0.22)), 14, OFFWHITE);
  // Fill pipe on top.
  b.cyl(chain(T(0.3, 0.76, 0), S(0.05, 0.16, 0.05)), 8, STEEL_DARK);
  return b;
}

/** A tall vertical tank with a shallow dome, on a round concrete pad. */
function tankTall() {
  const b = new Builder();
  b.cyl(chain(T(0, 0, 0), S(0.42, 0.08, 0.42)), 16, CONCRETE_DARK);
  b.cyl(chain(T(0, 0.08, 0), S(0.36, 1.25, 0.36)), 16, BRAND_STEEL);
  b.cyl(chain(T(0, 0.55, 0), S(0.365, 0.1, 0.365)), 16, WHITE);
  b.cyl(chain(T(0, 1.33, 0), S(0.36, 0.14, 0.36)), 16, OFFWHITE, 0.55);
  b.cyl(chain(T(0, 1.47, 0), S(0.2, 0.05, 0.2)), 16, STEEL);
  return b;
}

/**
 * A pipe run: two parallel pipes resting on three low supports (T joints), with an elbow
 * at one end turning down into a ground flange. Along x, 1.6 m long.
 */
function pipes() {
  const b = new Builder();
  for (const x of [-0.6, 0, 0.6]) {
    b.aabb(x - 0.05, 0, -0.18, x + 0.05, 0.05, 0.18, CONCRETE_DARK);
    b.aabb(x - 0.03, 0.05, -0.02, x + 0.03, 0.3, 0.02, STEEL_DARK);
    b.aabb(x - 0.04, 0.3, -0.2, x + 0.04, 0.33, 0.2, STEEL_DARK);
  }
  for (const [z, c] of [
    [-0.1, BRAND_TEAL],
    [0.1, STEEL],
  ]) {
    b.cyl(chain(T(-0.78, 0.4, z), Rz(-90), S(0.07, 1.48, 0.07)), 10, c);
  }
  // Elbows at the -x end down into flanges.
  for (const [z, c] of [
    [-0.1, BRAND_TEAL],
    [0.1, STEEL],
  ]) {
    b.cyl(chain(T(-0.78, 0.04, z), S(0.07, 0.43, 0.07)), 10, c);
    b.cyl(chain(T(-0.78, 0, z), S(0.11, 0.05, 0.11)), 10, STEEL_DARK);
  }
  // Valve wheel as a solid disc (no spokes).
  b.disc(I, 0.32, 0.4, 0.2, 0.08, 0.02, "#c9483b", 12);
  return b;
}

/** Two stacked shipping containers with vertical ribbing (parallel lines only). */
function containers() {
  const b = new Builder();
  const box = (y, z0, z1, c) => {
    b.aabb(-0.62, y, z0, 0.62, y + 0.42, z1, c);
    for (let x = -0.54; x <= 0.55; x += 0.12) {
      b.aabb(x - 0.012, y + 0.03, z1, x + 0.012, y + 0.39, z1 + 0.015, c);
      b.aabb(x - 0.012, y + 0.03, z0 - 0.015, x + 0.012, y + 0.39, z0, c);
    }
    b.aabb(0.62, y + 0.03, z0 + 0.03, 0.635, y + 0.39, z1 - 0.03, BRAND_GREY);
  };
  box(0, -0.26, 0.26, BRAND_STEEL);
  box(0.42, -0.24, 0.24, BRAND_TEAL);
  return b;
}

// ---------------------------------------------------------------- engineering
/** A blueprint table: steel legs, a tilted board with a blue sheet and parallel ruled lines. */
function blueprintTable() {
  const b = new Builder();
  for (const x of [-0.3, 0.3])
    for (const z of [-0.16, 0.16])
      b.aabb(x - 0.02, 0, z - 0.02, x + 0.02, 0.62, z + 0.02, STEEL_DARK);
  b.aabb(-0.32, 0.18, -0.18, 0.32, 0.2, 0.18, STEEL);
  const tilt = chain(T(0, 0.66, 0), Rx(14));
  b.aabb(-0.36, -0.02, -0.22, 0.36, 0.02, 0.22, WOOD, "base", tilt);
  b.aabb(-0.32, 0.02, -0.19, 0.3, 0.025, 0.17, PAPER_BLUE, "base", tilt);
  // A frame outline (L corners) and parallel ruled lines: no crossings.
  for (const z of [-0.15, -0.08, -0.01, 0.06, 0.13])
    b.aabb(
      -0.26,
      0.025,
      z,
      z > 0.1 ? 0.0 : 0.22,
      0.03,
      z + 0.008,
      PAPER_LINE,
      "base",
      tilt
    );
  b.aabb(0.24, 0.025, -0.15, 0.25, 0.03, 0.02, PAPER_LINE, "base", tilt);
  // Rolled drawings on the lower shelf.
  for (const z of [-0.08, 0.06])
    b.cyl(chain(T(-0.22, 0.24, z), Rz(-90), S(0.03, 0.42, 0.03)), 8, "#e8eef3");
  return b;
}

/**
 * The feasibility-study drafting pavilion: a concrete slab, four slim steel posts, a flat
 * deep-teal roof with a white fascia, a back wall holding a pinned blueprint board, and
 * two drafting desks under the roof.
 */
function draftingPavilion() {
  const b = new Builder();
  b.aabb(-0.95, 0, -0.78, 0.95, 0.1, 0.78, CONCRETE);
  for (const x of [-0.85, 0.85])
    for (const z of [-0.68, 0.68])
      b.aabb(x - 0.035, 0.1, z - 0.035, x + 0.035, 1.55, z + 0.035, STEEL);
  b.aabb(-1.0, 1.55, -0.84, 1.0, 1.66, 0.84, BRAND_TEAL);
  b.aabb(-1.02, 1.66, -0.86, 1.02, 1.72, 0.86, WHITE);
  // Back wall (-z) with a blueprint board.
  b.aabb(-0.82, 0.1, -0.7, 0.82, 1.2, -0.62, OFFWHITE);
  b.aabb(-0.5, 0.55, -0.62, 0.5, 1.05, -0.6, PAPER_BLUE);
  for (const y of [0.65, 0.75, 0.85, 0.95])
    b.aabb(-0.44, y, -0.6, 0.3, y + 0.012, -0.595, PAPER_LINE);
  // Two drafting desks.
  for (const x of [-0.42, 0.42]) {
    for (const dx of [-0.2, 0.2])
      b.aabb(x + dx - 0.02, 0.1, -0.1, x + dx + 0.02, 0.62, -0.06, STEEL_DARK);
    const tilt = chain(T(x, 0.66, 0.02), Rx(16));
    b.aabb(-0.26, -0.02, -0.18, 0.26, 0.02, 0.18, WOOD, "base", tilt);
    b.aabb(-0.22, 0.02, -0.15, 0.22, 0.025, 0.14, PAPER_BLUE, "base", tilt);
  }
  // A ceiling light strip.
  b.aabb(-0.6, 1.51, -0.05, 0.6, 1.55, 0.05, WARM_LIGHT, "glow");
  return b;
}

/** A surveying instrument on a three-legged tripod (legs meet only at the head). */
function surveyTripod() {
  const b = new Builder();
  const head = [0, 0.78, 0];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    b.beam([Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24], head, 0.025, "#d9a441");
  }
  b.aabb(-0.08, 0.78, -0.08, 0.08, 0.82, 0.08, STEEL_DARK);
  b.aabb(-0.06, 0.82, -0.05, 0.06, 0.94, 0.05, "#f0c419");
  b.cyl(chain(T(0, 0.88, 0.05), Rx(90), S(0.03, 0.12, 0.03)), 10, STEEL_DARK);
  return b;
}

// ---------------------------------------------------------------- street and plaza
/** A slim modern street lamp: a steel pole with one arm (an L) and a warm light head. */
function lamp() {
  const b = new Builder();
  b.cyl(chain(T(0, 0, 0), S(0.08, 0.06, 0.08)), 10, CONCRETE_DARK);
  b.aabb(-0.025, 0.06, -0.025, 0.025, 1.9, 0.025, BRAND_GREY);
  b.aabb(-0.025, 1.86, -0.025, 0.025, 1.9, 0.36, BRAND_GREY);
  b.aabb(-0.06, 1.8, 0.24, 0.06, 1.86, 0.4, BRAND_GREY);
  b.aabb(-0.05, 1.78, 0.26, 0.05, 1.8, 0.38, WARM_LIGHT, "glow");
  return b;
}

/** The entrance monolith by the bridge: a teal slab with one horizontal light band (no text). */
function monolith() {
  const b = new Builder();
  b.aabb(-0.42, 0, -0.14, 0.42, 0.08, 0.14, CONCRETE);
  b.aabb(-0.32, 0.08, -0.08, 0.32, 1.25, 0.08, BRAND_TEAL);
  b.aabb(-0.3, 0.92, 0.08, 0.3, 0.98, 0.09, BRAND_MIST, "glow");
  b.aabb(-0.33, 1.25, -0.09, 0.33, 1.3, 0.09, WHITE);
  return b;
}

/** A shaded majlis bench: a stone bench under a slim white canopy on two posts. */
function shadeBench() {
  const b = new Builder();
  b.aabb(-0.55, 0, -0.18, 0.55, 0.3, 0.18, STONE);
  b.aabb(-0.55, 0.3, -0.18, 0.55, 0.34, 0.18, STONE_DARK);
  b.aabb(-0.55, 0.34, -0.2, 0.55, 0.62, -0.14, STONE);
  for (const x of [-0.6, 0.6])
    b.aabb(x - 0.025, 0, -0.26, x + 0.025, 1.35, -0.21, BRAND_GREY);
  b.aabb(-0.7, 1.35, -0.32, 0.7, 1.39, 0.32, WHITE);
  return b;
}

/** A square stone planter with a low clipped shrub, for the palm courtyard edges. */
function planter() {
  const b = new Builder();
  b.aabb(-0.3, 0, -0.3, 0.3, 0.32, 0.3, STONE);
  b.aabb(-0.33, 0.32, -0.33, 0.33, 0.36, 0.33, STONE_DARK);
  b.ico(chain(T(0, 0.48, 0), S(0.24, 0.18, 0.24)), "#6f9a4a");
  return b;
}

// ---------------------------------------------------------------- teryaq (workshop lot)
const TERYAQ_GREEN = "#408a71";
const TERYAQ_OFFWHITE = "#f5f5f5";
const TERYAQ_MINT = "#b2ddc9";

/**
 * Teryaq's "coming soon" lot billboard: two posts, a green board with an off-white panel,
 * a mint band and a heartbeat pulse line (a flat line with one sharp peak and dip). The
 * pulse is a chain of beams meeting end to end: no crossing strokes, no plus or cross.
 */
function teryaqBillboard() {
  const b = new Builder();
  const w = 1.3;
  const h = 0.8;
  const y0 = 0.7;
  for (const x of [-w / 2 + 0.18, w / 2 - 0.18])
    b.aabb(x - 0.04, 0, -0.04, x + 0.04, y0 + 0.1, 0.04, BRAND_GREY);
  b.aabb(-w / 2, y0, 0.04, w / 2, y0 + h, 0.1, TERYAQ_GREEN);
  const z = 0.1;
  b.aabb(
    -w / 2 + 0.05,
    y0 + 0.05,
    z,
    w / 2 - 0.05,
    y0 + h - 0.05,
    z + 0.01,
    TERYAQ_OFFWHITE
  );
  b.aabb(
    -w / 2 + 0.05,
    y0 + 0.05,
    z + 0.01,
    w / 2 - 0.05,
    y0 + 0.2,
    z + 0.015,
    TERYAQ_MINT
  );
  // Heartbeat line across the panel.
  const yc = y0 + 0.46;
  const pts = [
    [-0.52, yc],
    [-0.2, yc],
    [-0.12, yc + 0.08],
    [-0.04, yc - 0.2],
    [0.06, yc + 0.24],
    [0.14, yc - 0.06],
    [0.2, yc],
    [0.52, yc],
  ];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, ya] = pts[i];
    const [x1, yb] = pts[i + 1];
    b.beam([x0, ya, z + 0.02], [x1, yb, z + 0.02], 0.035, TERYAQ_GREEN, 0.012);
  }
  // A round "pulse" dot at the end of the line.
  b.disc(I, 0.52, yc, z + 0.02, 0.04, 0.012, TERYAQ_GREEN, 12);
  return b;
}

const MODELS = {
  "w-billboard-teryaq": [
    teryaqBillboard,
    {
      kind: "prop",
      tags: ["billboard", "coming-soon", "construction", "workshop", "teryaq"],
    },
  ],
  "w-hq": [
    hq,
    {
      kind: "building",
      footprint: [1, 1],
      footprintUnit: "hex",
      tags: ["hq", "office", "consultancy", "modern", "waco"],
    },
  ],
  "w-factory-mist": [
    factory(BRAND_MIST, OFFWHITE),
    {
      kind: "building",
      footprint: [1, 1],
      footprintUnit: "hex",
      tags: ["factory", "industrial", "chimney", "waco"],
    },
  ],
  "w-factory-stone": [
    factory(STONE, BRAND_STEEL),
    {
      kind: "building",
      footprint: [1, 1],
      footprintUnit: "hex",
      tags: ["factory", "industrial", "chimney", "waco"],
    },
  ],
  "w-silos": [silos, { kind: "prop", tags: ["silo", "industrial", "waco"] }],
  "w-tank-lying": [
    tankLying,
    { kind: "prop", tags: ["tank", "industrial", "waco"] },
  ],
  "w-tank-tall": [
    tankTall,
    { kind: "prop", tags: ["tank", "industrial", "waco"] },
  ],
  "w-pipes": [pipes, { kind: "prop", tags: ["pipes", "industrial", "waco"] }],
  "w-containers": [
    containers,
    { kind: "prop", tags: ["container", "industrial", "waco"] },
  ],
  "w-blueprint-table": [
    blueprintTable,
    { kind: "prop", tags: ["blueprint", "table", "engineering", "waco"] },
  ],
  "w-drafting-pavilion": [
    draftingPavilion,
    {
      kind: "building",
      footprint: [1, 1],
      footprintUnit: "hex",
      tags: ["pavilion", "drafting", "engineering", "waco"],
    },
  ],
  "w-survey-tripod": [
    surveyTripod,
    { kind: "prop", tags: ["survey", "tripod", "engineering", "waco"] },
  ],
  "w-lamp": [
    lamp,
    { kind: "prop", tags: ["lamp", "street", "modern", "waco"] },
  ],
  "w-monolith": [
    monolith,
    { kind: "prop", tags: ["sign", "monolith", "waco"] },
  ],
  "w-shade-bench": [
    shadeBench,
    { kind: "prop", tags: ["bench", "seat", "shade", "waco"] },
  ],
  "w-planter": [planter, { kind: "prop", tags: ["planter", "garden", "waco"] }],
};

// ---------------------------------------------------------------- glb writer
const MATERIALS = {
  base: { roughness: 0.9, metallic: 0 },
  glass: { roughness: 0.15, metallic: 0.1, alpha: 0.55 },
  glow: { roughness: 0.6, metallic: 0, emissive: [1, 0.72, 0.38] },
};

async function writeModel(io, name, builder) {
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh(name);
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const [group, tris] of Object.entries(builder.groups)) {
    if (tris.length === 0) continue;
    const pos = new Float32Array(tris.length * 9);
    const nor = new Float32Array(tris.length * 9);
    const col = new Float32Array(tris.length * 9);
    tris.forEach((t, i) => {
      [t.a, t.b, t.c].forEach((p, j) => {
        pos.set(p, i * 9 + j * 3);
        nor.set(t.n, i * 9 + j * 3);
        col.set(t.rgb, i * 9 + j * 3);
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], p[k]);
          max[k] = Math.max(max[k], p[k]);
        }
      });
    });
    const spec = MATERIALS[group];
    const mat = doc
      .createMaterial(`${name}-${group}`)
      .setBaseColorFactor([1, 1, 1, spec.alpha ?? 1])
      .setRoughnessFactor(spec.roughness)
      .setMetallicFactor(spec.metallic);
    if (spec.alpha) mat.setAlphaMode("BLEND");
    if (spec.emissive) mat.setEmissiveFactor(spec.emissive);
    const prim = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer)
      )
      .setAttribute(
        "NORMAL",
        doc.createAccessor().setType("VEC3").setArray(nor).setBuffer(buffer)
      )
      .setAttribute(
        "COLOR_0",
        doc.createAccessor().setType("VEC3").setArray(col).setBuffer(buffer)
      )
      .setMaterial(mat);
    mesh.addPrimitive(prim);
  }
  const node = doc.createNode(name).setMesh(mesh);
  doc.createScene(name).addChild(node);
  // Quantised attributes (KHR_mesh_quantization) roughly halve the files.
  await doc.transform(quantize({ quantizeNormal: 8, quantizeColor: 8 }));
  const file = path.join(OUT_DIR, `${name}.glb`);
  await io.write(file, doc);
  const stat = await fs.stat(file);
  const r = (v) => Math.round(v * 1000) / 1000;
  return {
    size: [r(max[0] - min[0]), r(max[1] - min[1]), r(max[2] - min[2])],
    minY: r(min[1]),
    bytes: stat.size,
  };
}

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const models = {};
  for (const [name, [build, extra]] of Object.entries(MODELS)) {
    const { size, minY, bytes } = await writeModel(io, name, build());
    const hexUnit = extra.footprintUnit === "hex";
    models[name] = {
      file: `${name}.glb`,
      source: "procedural",
      license: "CC0",
      kind: extra.kind,
      footprint: extra.footprint ?? [size[0], size[2]],
      footprintUnit: hexUnit ? "hex" : "m",
      height: size[1],
      scale: 1,
      size,
      minY,
      tags: extra.tags,
      solid: extra.solid ?? true,
      // Island-specific props: not part of the first-load budget (manifest3d.test.ts).
      lazy: true,
      bytes,
      ...(extra.overlay
        ? { overlay: true, walkable: extra.walkable ?? true }
        : {}),
      banned: false,
      reason: "",
    };
    console.log(
      name.padEnd(22),
      size.join(" x "),
      `${(bytes / 1024).toFixed(1)} KB`
    );
  }
  await fs.writeFile(FRAGMENT, `${JSON.stringify({ models }, null, 2)}\n`);
}

await main();
