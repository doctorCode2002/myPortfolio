/**
 * World v2 procedural models for the workshop island ("Under construction"): a tower
 * crane (mast, a rotating jib and a hanging load as separate models so the jib can turn
 * at runtime), striped safety barriers, traffic cones, a site office cabin, a "coming
 * soon" billboard, half-built houses, an empty plot with a blank sale sign, a cement mixer
 * and a brick pallet. Small flat-shaded low-poly glbs with vertex colours, written to
 * public/game3d/models/v2-<name>.glb and registered in public/game3d/models/custom-v2.json.
 *
 *   node scripts/3d/procedural/v2-construction.mjs
 *
 * Every model is CC0 (our own geometry). No cross shapes anywhere: the crane's mast and
 * jib are ladder-style (posts or chords joined by rungs that end at them, never diagonal
 * X-bracing), bars only meet at their ends or in T/L joints, and wheels are solid discs.
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
const FRAGMENT = path.join(OUT_DIR, "custom-v2.json");

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
const YELLOW = "#f2b630";
const YELLOW_DARK = "#c98d1c";
const STEEL = "#5d6670";
const STEEL_DARK = "#3c434b";
const CONCRETE = "#b9b4aa";
const CONCRETE_DARK = "#958f84";
const RED = "#d8483a";
const WHITE = "#f4f1ea";
const ORANGE = "#ef7a2a";
const WOOD = "#b98552";
const WOOD_DARK = "#7f5634";
const PLANK = "#d9b07a";
const BRICK = "#c2643f";
const BRICK_DARK = "#a24f31";
const GLASS = "#9fd3e6";
const BLUE = "#3f7fbf";
const CREAM = "#efe3c8";
const ROOF = "#4f6f8f";

// ---------------------------------------------------------------- crane
/** Square ladder tower: four corner posts joined by horizontal rungs on every side. */
function ladderTower(b, x0, z0, w, y0, y1, step, post, rung, color) {
  const h = w / 2;
  const corners = [
    [x0 - h, z0 - h],
    [x0 + h, z0 - h],
    [x0 + h, z0 + h],
    [x0 - h, z0 + h],
  ];
  for (const [x, z] of corners)
    b.aabb(x - post, y0, z - post, x + post, y1, z + post, color);
  for (let y = y0 + step * 0.5; y < y1 - step * 0.25; y += step) {
    // Rungs stop at the posts (T joints), never past them.
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      if (ax === bx) {
        b.aabb(
          ax - rung,
          y - rung,
          Math.min(az, bz) + post,
          ax + rung,
          y + rung,
          Math.max(az, bz) - post,
          color
        );
      } else {
        b.aabb(
          Math.min(ax, bx) + post,
          y - rung,
          az - rung,
          Math.max(ax, bx) - post,
          y + rung,
          az + rung,
          color
        );
      }
    }
  }
}

const MAST_H = 5.2;

/** The crane's mast: ballast footing, a ladder tower and the slewing ring on top (y = MAST_H). */
function craneMast() {
  const b = new Builder();
  b.aabb(-0.55, 0, -0.55, 0.55, 0.28, 0.55, CONCRETE);
  b.aabb(-0.42, 0.28, -0.42, 0.42, 0.36, 0.42, CONCRETE_DARK);
  ladderTower(b, 0, 0, 0.5, 0.36, MAST_H - 0.12, 0.45, 0.045, 0.022, YELLOW);
  b.cyl(chain(T(0, MAST_H - 0.12, 0), S(0.34, 0.12, 0.34)), 12, STEEL_DARK);
  return b;
}

/** Jib arm length (along +x) and the trolley's resting position on it. */
const JIB_LEN = 4.6;
const TROLLEY_X = 3.1;

/** The slewing part (origin = the top of the mast): cab, tower head, jib, counter-jib, ties. */
function craneJib() {
  const b = new Builder();
  // Turntable and operator cab on the jib side.
  b.cyl(chain(T(0, 0, 0), S(0.32, 0.1, 0.32)), 12, STEEL);
  b.aabb(0.2, 0.1, 0.22, 0.62, 0.52, 0.6, YELLOW);
  b.aabb(0.62, 0.2, 0.26, 0.64, 0.46, 0.56, GLASS, "glass");
  b.aabb(0.24, 0.24, 0.6, 0.58, 0.46, 0.62, GLASS, "glass");
  // Tower head: a short ladder tower above the turntable.
  ladderTower(b, 0, 0, 0.36, 0.1, 1.3, 0.4, 0.035, 0.018, YELLOW_DARK);
  b.aabb(-0.22, 1.3, -0.22, 0.22, 1.36, 0.22, YELLOW_DARK);
  // Jib: a ladder lying on its side (two lower chords, one top chord, upright posts only).
  const jy = 0.62;
  const jh = 0.32;
  const jw = 0.16;
  b.aabb(0.2, jy - 0.03, -jw - 0.03, JIB_LEN, jy + 0.03, -jw + 0.03, YELLOW);
  b.aabb(0.2, jy - 0.03, jw - 0.03, JIB_LEN, jy + 0.03, jw + 0.03, YELLOW);
  b.aabb(
    0.2,
    jy + jh - 0.03,
    -0.03,
    JIB_LEN - 0.1,
    jy + jh + 0.03,
    0.03,
    YELLOW
  );
  for (let x = 0.5; x < JIB_LEN; x += 0.42) {
    // Floor rung between the lower chords, and two posts up to the top chord (T joints).
    b.aabb(
      x - 0.02,
      jy - 0.02,
      -jw + 0.03,
      x + 0.02,
      jy + 0.02,
      jw - 0.03,
      YELLOW
    );
    b.aabb(x - 0.02, jy + 0.03, -0.02, x + 0.02, jy + jh - 0.03, 0.02, YELLOW);
  }
  b.aabb(
    JIB_LEN - 0.05,
    jy - 0.05,
    -jw - 0.05,
    JIB_LEN + 0.05,
    jy + 0.1,
    jw + 0.05,
    YELLOW_DARK
  );
  // Counter-jib (towards -x) with its concrete counterweights.
  b.aabb(-2.0, jy - 0.04, -jw - 0.03, -0.2, jy + 0.04, jw + 0.03, YELLOW);
  b.aabb(-1.95, jy + 0.04, -0.22, -1.35, jy + 0.48, 0.22, CONCRETE);
  b.aabb(-1.3, jy + 0.04, -0.2, -1.0, jy + 0.36, 0.2, CONCRETE_DARK);
  // Tie bars from the head to the jib and counter-jib (single bars that meet at their ends).
  b.beam([0, 1.34, 0], [JIB_LEN * 0.62, jy + jh + 0.03, 0], 0.025, STEEL);
  b.beam([0, 1.34, 0], [-1.6, jy + 0.06, 0], 0.025, STEEL);
  // Trolley under the jib, where the load hangs.
  b.aabb(
    TROLLEY_X - 0.14,
    jy - 0.14,
    -0.12,
    TROLLEY_X + 0.14,
    jy - 0.03,
    0.12,
    STEEL_DARK
  );
  return b;
}

/** The hanging load (origin = the trolley): cable, hook block and a bundle of planks. */
function craneLoad() {
  const b = new Builder();
  const drop = 2.3;
  b.aabb(-0.012, -drop, -0.012, 0.012, 0, 0.012, STEEL_DARK);
  b.aabb(-0.07, -drop - 0.14, -0.05, 0.07, -drop, 0.05, YELLOW);
  // Two slings down to the bundle, as an upside-down "V" (they meet only at the hook).
  b.beam([0, -drop - 0.14, 0], [-0.32, -drop - 0.5, 0], 0.014, STEEL);
  b.beam([0, -drop - 0.14, 0], [0.32, -drop - 0.5, 0], 0.014, STEEL);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++)
      b.aabb(
        -0.42,
        -drop - 0.5 - 0.07 * (j + 1),
        -0.15 + i * 0.1,
        0.42,
        -drop - 0.5 - 0.07 * j,
        -0.06 + i * 0.1,
        j ? WOOD : PLANK
      );
  return b;
}

// ---------------------------------------------------------------- site props
/** A striped safety barrier: two feet, two uprights and one red-and-white board. */
function barrier() {
  const b = new Builder();
  const w = 1.0;
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) {
    b.aabb(x - 0.05, 0, -0.16, x + 0.05, 0.05, 0.16, STEEL_DARK);
    b.aabb(x - 0.025, 0.05, -0.025, x + 0.025, 0.62, 0.025, STEEL);
  }
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + (w * i) / n;
    b.aabb(x0, 0.44, -0.035, x0 + w / n, 0.6, 0.035, i % 2 ? WHITE : RED);
  }
  return b;
}

function cone() {
  const b = new Builder();
  b.aabb(-0.14, 0, -0.14, 0.14, 0.03, 0.14, ORANGE);
  b.cyl(chain(T(0, 0.03, 0), S(0.1, 0.16, 0.1)), 10, ORANGE, 0.64);
  b.cyl(chain(T(0, 0.19, 0), S(0.064, 0.07, 0.064)), 10, WHITE, 0.75);
  b.cyl(chain(T(0, 0.26, 0), S(0.048, 0.12, 0.048)), 10, ORANGE, 0.2);
  return b;
}

/** A portable site office: a cabin on blocks with windows, a door and steps facing +z. */
function siteOffice() {
  const b = new Builder();
  const w = 1.8;
  const d = 1.0;
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15])
    for (const z of [-d / 2 + 0.12, d / 2 - 0.12])
      b.aabb(x - 0.1, 0, z - 0.1, x + 0.1, 0.12, z + 0.1, CONCRETE_DARK);
  b.aabb(-w / 2, 0.12, -d / 2, w / 2, 1.12, d / 2, CREAM);
  // Corrugation lines along the walls.
  for (let x = -w / 2 + 0.2; x < w / 2 - 0.1; x += 0.2)
    b.aabb(x - 0.012, 0.16, d / 2, x + 0.012, 1.08, d / 2 + 0.01, "#ddd0b2");
  b.aabb(
    -w / 2 - 0.05,
    1.12,
    -d / 2 - 0.05,
    w / 2 + 0.05,
    1.2,
    d / 2 + 0.05,
    BLUE
  );
  // Door, windows and the steps.
  b.aabb(0.35, 0.14, d / 2, 0.68, 0.92, d / 2 + 0.03, BLUE);
  b.aabb(0.6, 0.5, d / 2 + 0.03, 0.64, 0.56, d / 2 + 0.05, STEEL_DARK);
  b.aabb(-0.7, 0.55, d / 2, -0.15, 0.9, d / 2 + 0.02, GLASS, "glass");
  b.aabb(-w / 2 - 0.02, 0.55, -0.3, -w / 2, 0.9, 0.2, GLASS, "glass");
  b.aabb(0.3, 0, d / 2, 0.72, 0.07, d / 2 + 0.32, CONCRETE);
  b.aabb(0.3, 0.07, d / 2, 0.72, 0.13, d / 2 + 0.16, CONCRETE);
  // A warm lamp over the door.
  b.aabb(0.46, 1.0, d / 2, 0.58, 1.06, d / 2 + 0.08, "#ffd27a", "glow");
  return b;
}

/**
 * A "coming soon" billboard: two legs and a board with a simple picture (a house outline
 * rising behind a progress bar), no text.
 */
function billboard(accent) {
  const b = new Builder();
  const w = 1.3;
  const h = 0.8;
  const y0 = 0.7;
  for (const x of [-w / 2 + 0.18, w / 2 - 0.18]) {
    b.aabb(x - 0.04, 0, -0.04, x + 0.04, y0 + 0.1, 0.04, WOOD_DARK);
  }
  b.aabb(-w / 2, y0, 0.04, w / 2, y0 + h, 0.1, WOOD);
  const z = 0.1;
  b.aabb(
    -w / 2 + 0.05,
    y0 + 0.05,
    z,
    w / 2 - 0.05,
    y0 + h - 0.05,
    z + 0.01,
    WHITE
  );
  // Sky band, a house shape and the progress bar (frame plus the filled part).
  b.aabb(
    -w / 2 + 0.05,
    y0 + 0.42,
    z + 0.01,
    w / 2 - 0.05,
    y0 + h - 0.05,
    z + 0.015,
    "#cfe7f2"
  );
  b.aabb(-0.3, y0 + 0.3, z + 0.015, 0.1, y0 + 0.52, z + 0.022, accent);
  b.prism(chain(T(-0.1, y0 + 0.52, z + 0.018), S(0.5, 0.18, 0.008)), ROOF);
  b.aabb(-0.14, y0 + 0.3, z + 0.022, -0.04, y0 + 0.42, z + 0.026, WOOD_DARK);
  b.aabb(-0.5, y0 + 0.12, z + 0.015, 0.5, y0 + 0.22, z + 0.02, STEEL_DARK);
  b.aabb(-0.47, y0 + 0.14, z + 0.02, 0.15, y0 + 0.2, z + 0.026, accent);
  // A small sun in the corner.
  b.disc(I, 0.42, y0 + 0.6, z + 0.016, 0.07, 0.008, YELLOW, 10);
  return b;
}

/** Half-built house, walls stage: brick walls of uneven height with openings, no roof. */
function houseWalls() {
  const b = new Builder();
  const w = 1.5;
  const d = 1.3;
  b.aabb(
    -w / 2 - 0.08,
    0,
    -d / 2 - 0.08,
    w / 2 + 0.08,
    0.1,
    d / 2 + 0.08,
    CONCRETE
  );
  const t = 0.1;
  const rows = (x0, z0, x1, z1, hmax, gaps) => {
    // Brick courses; each course is a run of boxes, leaving door/window gaps.
    const n = Math.round(hmax / 0.12);
    for (let i = 0; i < n; i++) {
      const y = 0.1 + i * 0.12;
      const along = x0 === x1 ? [z0, z1] : [x0, x1];
      const segs = [[along[0], along[1]]];
      for (const g of gaps)
        if (y >= g.y0 && y < g.y1) {
          const s = segs.pop();
          segs.push([s[0], g.a], [g.b, s[1]]);
        }
      for (const [a, c] of segs) {
        if (c - a < 0.04) continue;
        const col = (i + Math.round(a * 10)) % 3 ? BRICK : BRICK_DARK;
        if (x0 === x1) b.aabb(x0 - t / 2, y, a, x0 + t / 2, y + 0.115, c, col);
        else b.aabb(a, y, z0 - t / 2, c, y + 0.115, z0 + t / 2, col);
      }
    }
  };
  const hw = w / 2;
  const hd = d / 2;
  rows(-hw, hd, hw, hd, 0.96, [{ a: -0.18, b: 0.18, y0: 0, y1: 0.85 }]);
  rows(-hw, -hd, hw, -hd, 1.2, [{ a: -0.45, b: -0.1, y0: 0.45, y1: 0.8 }]);
  rows(-hw, -hd + t / 2, -hw, hd - t / 2, 0.72, []);
  rows(hw, -hd + t / 2, hw, hd - t / 2, 1.08, [
    { a: -0.2, b: 0.2, y0: 0.45, y1: 0.8 },
  ]);
  // Lintel over the door and a few loose bricks on the slab.
  b.aabb(-0.24, 0.94, hd - t / 2, 0.24, 1.0, hd + t / 2, CONCRETE_DARK);
  b.aabb(0.3, 0.1, 0.1, 0.5, 0.2, 0.3, BRICK);
  b.aabb(0.32, 0.2, 0.12, 0.48, 0.3, 0.28, BRICK_DARK);
  return b;
}

/**
 * Half-built house, roofing stage: finished plaster walls with window holes, the roof's
 * rafters on a ridge beam (parallel A-frames, no braces), and a ladder-style scaffold on
 * one side.
 */
function houseRoofing() {
  const b = new Builder();
  const w = 1.5;
  const d = 1.3;
  const wh = 1.05;
  b.aabb(
    -w / 2 - 0.08,
    0,
    -d / 2 - 0.08,
    w / 2 + 0.08,
    0.1,
    d / 2 + 0.08,
    CONCRETE
  );
  const t = 0.1;
  const hw = w / 2;
  const hd = d / 2;
  // Walls as panels around the openings (front door, side windows).
  const front = (z, door) => {
    if (door) {
      b.aabb(-hw, 0.1, z - t / 2, -0.2, wh, z + t / 2, CREAM);
      b.aabb(0.2, 0.1, z - t / 2, hw, wh, z + t / 2, CREAM);
      b.aabb(-0.2, 0.85, z - t / 2, 0.2, wh, z + t / 2, CREAM);
    } else {
      b.aabb(-hw, 0.1, z - t / 2, hw, 0.45, z + t / 2, CREAM);
      b.aabb(-hw, 0.8, z - t / 2, hw, wh, z + t / 2, CREAM);
      b.aabb(-hw, 0.45, z - t / 2, -0.4, 0.8, z + t / 2, CREAM);
      b.aabb(-0.1, 0.45, z - t / 2, 0.15, 0.8, z + t / 2, CREAM);
      b.aabb(0.45, 0.45, z - t / 2, hw, 0.8, z + t / 2, CREAM);
    }
  };
  front(hd, true);
  front(-hd, false);
  for (const x of [-hw, hw]) {
    b.aabb(x - t / 2, 0.1, -hd + t / 2, x + t / 2, wh, hd - t / 2, CREAM);
  }
  // Gable ends (solid triangles) and the ridge beam along z.
  const ridge = 0.62;
  for (const z of [-hd, hd]) b.prism(chain(T(0, wh, z), S(w, ridge, t)), CREAM);
  b.aabb(
    -0.04,
    wh + ridge - 0.08,
    -hd - 0.05,
    0.04,
    wh + ridge,
    hd + 0.05,
    WOOD_DARK
  );
  // Rafters: parallel pairs from each eave up to the ridge, meeting only at the top.
  for (let z = -hd + 0.2; z < hd - 0.1; z += 0.26) {
    b.beam(
      [-hw - 0.08, wh - 0.02, z],
      [-0.02, wh + ridge - 0.06, z],
      0.045,
      WOOD
    );
    b.beam(
      [hw + 0.08, wh - 0.02, z],
      [0.02, wh + ridge - 0.06, z],
      0.045,
      WOOD
    );
  }
  // Part of the roof already tiled.
  b.box(
    chain(
      T(-hw / 2 - 0.02, wh + ridge / 2 + 0.03, -hd / 2 + 0.05),
      Rz((-Math.atan2(ridge, hw) * 180) / Math.PI),
      S(Math.hypot(hw, ridge) + 0.1, 0.05, hd)
    ),
    ROOF
  );
  // Scaffold along the right side: posts and planks, ladder style.
  const sx = hw + 0.32;
  for (const z of [-hd + 0.05, hd - 0.05]) {
    b.aabb(sx - 0.025, 0, z - 0.025, sx + 0.025, 1.45, z + 0.025, STEEL);
    b.aabb(sx + 0.2, 0, z - 0.025, sx + 0.25, 1.45, z + 0.025, STEEL);
  }
  for (const y of [0.5, 1.0]) {
    b.aabb(
      sx - 0.03,
      y - 0.02,
      -hd + 0.08,
      sx + 0.28,
      y + 0.03,
      hd - 0.08,
      PLANK
    );
  }
  for (const y of [0.3, 0.8, 1.3])
    for (const x of [sx, sx + 0.225])
      b.aabb(
        x - 0.015,
        y - 0.015,
        -hd + 0.08,
        x + 0.015,
        y + 0.015,
        hd - 0.08,
        STEEL
      );
  return b;
}

/** An empty lot: four corner stakes with a string outline and a blank hanging sign. */
function emptyPlot() {
  const b = new Builder();
  const h = 0.62;
  for (const [x, z] of [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ])
    b.aabb(x - 0.025, 0, z - 0.025, x + 0.025, 0.2, z + 0.025, WOOD);
  const s = 0.008;
  b.aabb(-h + 0.025, 0.16 - s, -h - s, h - 0.025, 0.16 + s, -h + s, WHITE);
  b.aabb(-h + 0.025, 0.16 - s, h - s, h - 0.025, 0.16 + s, h + s, WHITE);
  b.aabb(-h - s, 0.16 - s, -h + 0.025, -h + s, 0.16 + s, h - 0.025, WHITE);
  b.aabb(h - s, 0.16 - s, -h + 0.025, h + s, 0.16 + s, h - 0.025, WHITE);
  // Sale sign: a post with an arm (an "L" turned over), the board hangs from the arm.
  const px = -0.3;
  const pz = h - 0.12;
  b.aabb(px - 0.035, 0, pz - 0.035, px + 0.035, 0.95, pz + 0.035, WOOD_DARK);
  b.aabb(px - 0.035, 0.88, pz - 0.03, px + 0.55, 0.94, pz + 0.03, WOOD_DARK);
  b.aabb(px + 0.13, 0.82, pz - 0.006, px + 0.15, 0.88, pz + 0.006, STEEL);
  b.aabb(px + 0.43, 0.82, pz - 0.006, px + 0.45, 0.88, pz + 0.006, STEEL);
  b.aabb(px + 0.08, 0.5, pz - 0.025, px + 0.5, 0.82, pz + 0.025, RED);
  b.aabb(px + 0.11, 0.53, pz + 0.025, px + 0.47, 0.79, pz + 0.03, WHITE);
  return b;
}

/** A cement mixer: a tilted drum on a stand with two solid disc wheels. */
function cementMixer() {
  const b = new Builder();
  b.aabb(-0.3, 0.12, -0.06, 0.3, 0.18, 0.06, STEEL_DARK);
  for (const x of [-0.3, 0.3])
    b.disc(chain(Ry(90)), 0, 0.12, x, 0.12, 0.05, "#2b2f33", 10);
  b.aabb(-0.03, 0.18, -0.03, 0.03, 0.4, 0.03, STEEL);
  b.aabb(0.24, 0.18, -0.02, 0.28, 0.32, 0.02, STEEL);
  const m = chain(T(0, 0.38, 0), Rz(-35), T(0, -0.2, 0));
  b.cyl(chain(m, S(0.17, 0.3, 0.17)), 12, ORANGE, 1);
  b.cyl(chain(m, T(0, 0.3, 0), S(0.17, 0.12, 0.17)), 12, ORANGE, 0.55);
  b.cyl(chain(m, T(0, -0.04, 0), S(0.12, 0.04, 0.12)), 12, STEEL_DARK, 1);
  return b;
}

/** A pallet stacked with bricks. */
function brickPallet() {
  const b = new Builder();
  b.aabb(-0.3, 0, -0.25, 0.3, 0.06, 0.25, WOOD);
  for (let y = 0; y < 3; y++)
    for (let i = 0; i < 3; i++) {
      const alongX = y % 2 === 0;
      const o = -0.18 + i * 0.18;
      if (alongX)
        b.aabb(
          -0.27,
          0.06 + y * 0.09,
          o - 0.07,
          0.27,
          0.14 + y * 0.09,
          o + 0.07,
          (i + y) % 2 ? BRICK : BRICK_DARK
        );
      else
        b.aabb(
          o - 0.08,
          0.06 + y * 0.09,
          -0.22,
          o + 0.08,
          0.14 + y * 0.09,
          0.22,
          (i + y) % 2 ? BRICK_DARK : BRICK
        );
    }
  return b;
}

/** A low heap of sand or gravel. */
function sandPile() {
  const b = new Builder();
  b.cyl(chain(S(0.55, 0.22, 0.45)), 9, "#d9c08a", 0.45);
  b.cyl(chain(T(0.12, 0, 0.05), S(0.32, 0.32, 0.3)), 7, "#cdb27c", 0.15);
  return b;
}

const MODELS = {
  "v2-crane-mast": [
    craneMast,
    { kind: "prop", tags: ["crane", "construction", "workshop"] },
  ],
  "v2-crane-jib": [
    craneJib,
    {
      kind: "prop",
      solid: false,
      tags: ["crane", "construction", "workshop", "animated"],
    },
  ],
  "v2-crane-load": [
    craneLoad,
    {
      kind: "prop",
      solid: false,
      tags: ["crane", "construction", "workshop", "animated"],
    },
  ],
  "v2-barrier": [
    barrier,
    { kind: "prop", tags: ["barrier", "safety", "construction", "workshop"] },
  ],
  "v2-cone": [
    cone,
    { kind: "prop", tags: ["cone", "safety", "construction", "workshop"] },
  ],
  "v2-site-office": [
    siteOffice,
    {
      kind: "building",
      footprint: [1, 1],
      footprintUnit: "hex",
      tags: ["office", "cabin", "construction", "workshop"],
    },
  ],
  "v2-billboard-a": [
    () => billboard("#e0663c"),
    {
      kind: "prop",
      tags: ["billboard", "coming-soon", "construction", "workshop"],
    },
  ],
  "v2-billboard-b": [
    () => billboard("#3f9f7f"),
    {
      kind: "prop",
      tags: ["billboard", "coming-soon", "construction", "workshop"],
    },
  ],
  "v2-billboard-c": [
    () => billboard("#5a78c8"),
    {
      kind: "prop",
      tags: ["billboard", "coming-soon", "construction", "workshop"],
    },
  ],
  "v2-house-walls": [
    houseWalls,
    {
      kind: "building",
      footprint: [1, 1],
      footprintUnit: "hex",
      tags: ["house", "half-built", "construction", "workshop"],
    },
  ],
  "v2-house-roofing": [
    houseRoofing,
    {
      kind: "building",
      footprint: [1, 1],
      footprintUnit: "hex",
      tags: ["house", "half-built", "scaffold", "construction", "workshop"],
    },
  ],
  "v2-empty-plot": [
    emptyPlot,
    {
      kind: "prop",
      tags: ["plot", "for-sale", "sign", "construction", "workshop"],
    },
  ],
  "v2-cement-mixer": [
    cementMixer,
    { kind: "prop", tags: ["mixer", "cement", "construction", "workshop"] },
  ],
  "v2-brick-pallet": [
    brickPallet,
    { kind: "prop", tags: ["bricks", "pallet", "construction", "workshop"] },
  ],
  "v2-sand-pile": [
    sandPile,
    { kind: "prop", tags: ["sand", "pile", "construction", "workshop"] },
  ],
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
