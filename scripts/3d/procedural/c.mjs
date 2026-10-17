/**
 * Group "c" procedural models (the saleh and eyad islands): small flat-shaded low-poly glbs
 * built from boxes, prisms, cylinders and icosahedra with vertex colours, written to
 * public/game3d/models/c-<name>.glb and registered in public/game3d/models/custom-c.json.
 *
 *   node scripts/3d/procedural/c.mjs
 *
 * Every model is CC0 (our own geometry). No cross shapes anywhere: bars only meet at their
 * ends or form T/L/H joints, never a "+" or an "X".
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
const FRAGMENT = path.join(OUT_DIR, "custom-c.json");

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

// ---------------------------------------------------------------- paintings
/**
 * Paint a picture on a canvas whose front face is the plane z=0 in `m`, spanning
 * u in [-w/2, w/2], v in [0, h]. Each layer sits a little further forward.
 */
function paint(b, m, w, h, design) {
  let layer = 0;
  const L = () => 0.004 + 0.003 * layer++;
  const rect = (u0, v0, u1, v1, color) => {
    const z = L();
    b.aabb(u0 * w, v0 * h, 0, u1 * w, v1 * h, z, color, "base", m);
  };
  const circle = (u, v, r, color, seg = 12) => {
    const z = L();
    b.cyl(chain(m, T(u * w, v * h, 0), Rx(90), S(r * w, z, r * w)), seg, color);
  };
  const tri = (u0, u1, v0, v1, apex, color) => {
    const z = L();
    b.prism(
      chain(
        m,
        T(((u0 + u1) / 2) * w, v0 * h, z / 2),
        S((u1 - u0) * w, (v1 - v0) * h, z)
      ),
      color,
      "base",
      apex
    );
  };
  const line = (u0, v0, u1, v1, t, color) => {
    const z = L();
    const p0 = apply(m, [u0 * w, v0 * h, z / 2]);
    const p1 = apply(m, [u1 * w, v1 * h, z / 2]);
    b.beam(p0, p1, t, color, z);
  };
  switch (design) {
    case "autumn": {
      rect(-0.5, 0.62, 0.5, 1, "#f4c27a");
      rect(-0.5, 0.4, 0.5, 0.62, "#f09455");
      circle(0.18, 0.66, 0.11, "#fff0c2");
      rect(-0.5, 0, 0.5, 0.42, "#b65a32");
      tri(-0.5, 0.2, 0.3, 0.62, -0.1, "#8a3f2c");
      tri(-0.1, 0.5, 0.3, 0.55, 0.15, "#a24a2c");
      rect(-0.5, 0, 0.5, 0.26, "#d9893b");
      rect(-0.31, 0.2, -0.27, 0.48, "#4a2b1f");
      circle(-0.29, 0.55, 0.13, "#c9452c");
      circle(-0.2, 0.5, 0.09, "#e2742f");
      circle(0.3, 0.32, 0.07, "#f0b13a");
      rect(0.29, 0.15, 0.31, 0.3, "#4a2b1f");
      break;
    }
    case "sea": {
      rect(-0.5, 0.55, 0.5, 1, "#a8d8e8");
      circle(-0.25, 0.8, 0.09, "#fff7da");
      rect(-0.5, 0, 0.5, 0.55, "#2f6fa0");
      rect(-0.5, 0.42, 0.5, 0.47, "#5b98c4");
      rect(-0.5, 0.22, 0.5, 0.26, "#5b98c4");
      rect(-0.5, 0.06, 0.5, 0.1, "#7fb6d8");
      rect(0.0, 0.36, 0.34, 0.42, "#6b4a2e");
      tri(0.04, 0.3, 0.42, 0.82, -0.4, "#fbf6ea");
      break;
    }
    case "abstract": {
      rect(-0.5, 0, 0.5, 1, "#efe6d2");
      circle(-0.12, 0.62, 0.26, "#c8412f", 16);
      tri(0.02, 0.48, 0.08, 0.5, 0.1, "#2e5c9a");
      rect(-0.42, 0.08, -0.12, 0.3, "#f2c53d");
      rect(0.28, 0.6, 0.32, 0.95, "#222326");
      rect(-0.45, 0.36, -0.05, 0.39, "#222326");
      break;
    }
    case "blossom": {
      rect(-0.5, 0.35, 0.5, 1, "#dcefF4");
      rect(-0.5, 0, 0.5, 0.35, "#8cc56b");
      rect(-0.5, 0, 0.5, 0.14, "#6aa452");
      rect(-0.04, 0.2, 0.04, 0.55, "#6b4a35");
      circle(0, 0.66, 0.22, "#f2a7c3", 14);
      circle(-0.17, 0.56, 0.14, "#f7c6d8");
      circle(0.18, 0.58, 0.13, "#e98bb0");
      circle(0.34, 0.86, 0.07, "#fff3c4");
      break;
    }
    case "blueprint": {
      rect(-0.5, 0, 0.5, 1, "#2b5a9b");
      const c = "#e8f1fb";
      const t = 0.012;
      // A house elevation: walls, roof and door; lines only meet at their ends.
      line(-0.3, 0.12, 0.3, 0.12, t, c);
      line(-0.3, 0.12, -0.3, 0.5, t, c);
      line(0.3, 0.12, 0.3, 0.5, t, c);
      line(-0.36, 0.5, 0.36, 0.5, t, c);
      line(-0.36, 0.5, 0, 0.78, t, c);
      line(0.36, 0.5, 0, 0.78, t, c);
      line(-0.08, 0.12, -0.08, 0.32, t, c);
      line(0.08, 0.12, 0.08, 0.32, t, c);
      line(-0.08, 0.32, 0.08, 0.32, t, c);
      rect(0.14, 0.26, 0.24, 0.38, "#9cc2e8");
      rect(-0.24, 0.26, -0.14, 0.38, "#9cc2e8");
      line(-0.42, 0.9, -0.1, 0.9, t * 0.7, "#9cc2e8");
      line(-0.42, 0.86, -0.22, 0.86, t * 0.7, "#9cc2e8");
      break;
    }
    case "plan": {
      rect(-0.5, 0, 0.5, 1, "#f6f2e8");
      const c = "#33475e";
      const t = 0.014;
      // A floor plan: outer walls with a gap for the door, one inner wall (T joints only).
      line(-0.4, 0.1, 0.4, 0.1, t, c);
      line(0.4, 0.1, 0.4, 0.9, t, c);
      line(0.4, 0.9, -0.4, 0.9, t, c);
      line(-0.4, 0.9, -0.4, 0.45, t, c);
      line(-0.4, 0.3, -0.4, 0.1, t, c);
      line(0.05, 0.9, 0.05, 0.5, t, c);
      rect(0.12, 0.6, 0.34, 0.82, "#e9c7a0");
      rect(-0.32, 0.16, -0.08, 0.32, "#a8cfa0");
      break;
    }
    default:
      rect(-0.5, 0, 0.5, 1, "#f7f3ea");
  }
}

// ---------------------------------------------------------------- models
const WOOD = "#8a5a36";
const WOOD_DARK = "#5e3a24";
const WOOD_LIGHT = "#c79a62";
const CANVAS = "#f4efe3";
const STONE = "#e6ddcc";

function easel(design, k = 0.5) {
  const b = new Builder();
  const s = (p) => p.map((v) => v * k);
  // Front legs lean in to an apex; the back leg props it up (an "A", never an "X").
  b.beam(s([-0.42, 0, 0.18]), s([-0.08, 1.75, 0]), 0.05 * k, WOOD);
  b.beam(s([0.42, 0, 0.18]), s([0.08, 1.75, 0]), 0.05 * k, WOOD);
  b.beam(s([0, 0, -0.62]), s([0, 1.66, -0.04]), 0.045 * k, WOOD_DARK);
  // Canvas ledge between the front legs (ends at the legs).
  b.aabb(...s([-0.25, 0.78, 0.06]), ...s([0.25, 0.84, 0.24]), WOOD_DARK);
  // The canvas, tilted back a little.
  const cm = chain(S(k), T(0, 0.84, 0.16), Rx(-9));
  const w = 0.9;
  const h = 0.8;
  b.aabb(-w / 2, 0, -0.05, w / 2, h, 0, CANVAS, "base", cm);
  paint(b, cm, w * 0.94, h * 0.94, design);
  return b;
}

function frameStand(design) {
  const b = new Builder();
  const k = 0.5;
  const w = 1.7;
  const h = 1.25;
  const y0 = 0.62;
  const m = chain(S(k), T(0, y0, 0));
  // Two posts with feet (each foot is an "L"/"T" at the floor, nothing crosses).
  for (const x of [-0.55, 0.55]) {
    b.aabb(
      x - 0.05,
      0,
      -0.05,
      x + 0.05,
      y0 + 0.2,
      0.05,
      WOOD_DARK,
      "base",
      S(k)
    );
    b.aabb(x - 0.07, 0, -0.32, x + 0.07, 0.06, 0.32, WOOD_DARK, "base", S(k));
  }
  // Gilded frame and the painting.
  b.aabb(
    -w / 2 - 0.08,
    -0.08,
    -0.09,
    w / 2 + 0.08,
    h + 0.08,
    0.02,
    "#c9a24a",
    "base",
    m
  );
  b.aabb(-w / 2, 0, -0.06, w / 2, h, 0.03, CANVAS, "base", m);
  const pm = chain(m, T(0, 0.03, 0.03));
  paint(b, pm, w * 0.98, h * 0.95, design);
  return b;
}

function gallery() {
  const b = new Builder();
  const BRICK = "#9c3e2a";
  const BRICK_LIGHT = "#b5543a";
  const WHITE = "#ece4d4";
  const SLATE = "#4f4b59";
  // Plinth and brick hall.
  b.aabb(-0.96, 0, -0.96, 0.96, 0.12, 0.62, "#cfc5b3");
  b.aabb(-0.86, 0.12, -0.86, 0.86, 1.45, 0.52, BRICK);
  for (let y = 0.27; y < 1.42; y += 0.19)
    b.aabb(-0.875, y, -0.875, 0.875, y + 0.035, 0.535, BRICK_LIGHT);
  // Stone corner pilasters and cornice.
  for (const x of [-0.84, 0.84])
    for (const z of [-0.84, 0.5])
      b.aabb(x - 0.06, 0.12, z - 0.06, x + 0.06, 1.45, z + 0.06, WHITE);
  b.aabb(-0.93, 1.45, -0.93, 0.93, 1.55, 0.6, WHITE);
  // Main gable roof (ridge along z) with glass skylights on both slopes.
  const roofW = 1.96;
  const rise = 0.62;
  b.prism(chain(T(0, 1.55, -0.18), S(roofW, rise, 1.58)), SLATE);
  const ang = (Math.atan2(rise, roofW / 2) * 180) / Math.PI;
  const slope = Math.hypot(rise, roofW / 2);
  for (const side of [-1, 1]) {
    const m = chain(
      T((side * roofW) / 4, 1.55 + rise / 2, -0.25),
      Rz(-side * ang)
    );
    b.aabb(
      -slope * 0.22,
      0,
      -0.5,
      slope * 0.22,
      0.03,
      0.5,
      "#a9d5e6",
      "glass",
      m
    );
    b.aabb(
      -slope * 0.25,
      -0.01,
      -0.53,
      slope * 0.25,
      0.015,
      0.53,
      WHITE,
      "base",
      m
    );
  }
  // Portico: steps, two columns, entablature and pediment with a round window.
  b.aabb(-0.6, 0, 0.5, 0.6, 0.06, 1.04, "#d8cfbe");
  b.aabb(-0.55, 0.06, 0.5, 0.55, 0.12, 0.96, "#e2d9c9");
  for (const x of [-0.42, 0.42]) {
    b.aabb(x - 0.09, 0.12, 0.76, x + 0.09, 0.2, 0.94, WHITE);
    b.cyl(chain(T(x, 0.2, 0.85), S(0.065, 1.17, 0.065)), 10, "#f4eee2");
    b.aabb(x - 0.09, 1.37, 0.76, x + 0.09, 1.45, 0.94, WHITE);
  }
  b.aabb(-0.58, 1.45, 0.5, 0.58, 1.58, 0.97, WHITE);
  b.prism(chain(T(0, 1.58, 0.73), S(1.16, 0.42, 0.48)), WHITE);
  b.prism(chain(T(0, 1.62, 0.975), S(0.9, 0.3, 0.01)), "#d7c6a6");
  b.disc(I, 0, 1.73, 0.982, 0.085, 0.012, "#ffd27a", 12, "glow");
  for (const side of [-1, 1]) {
    const pang = (Math.atan2(0.42, 0.58) * 180) / Math.PI;
    const m = chain(T((side * 0.58) / 2, 1.58 + 0.21, 0.74), Rz(-side * pang));
    b.aabb(-0.38, 0.0, -0.27, 0.38, 0.05, 0.27, SLATE, "base", m);
  }
  // Arched double door.
  b.aabb(-0.26, 0.12, 0.515, 0.26, 0.92, 0.535, WHITE);
  b.disc(I, 0, 0.92, 0.525, 0.26, 0.02, WHITE, 14);
  b.aabb(-0.2, 0.12, 0.53, 0.2, 0.9, 0.555, WOOD_DARK);
  b.disc(I, 0, 0.9, 0.543, 0.2, 0.024, WOOD_DARK, 14);
  b.aabb(-0.006, 0.12, 0.556, 0.006, 1.06, 0.562, "#3f2617");
  for (const x of [-0.05, 0.05])
    b.aabb(x - 0.015, 0.5, 0.556, x + 0.015, 0.53, 0.575, "#d9b25a");
  // Warm arched windows: two on the front, two per side, a big studio window at the back.
  const archWindow = (m, w, h) => {
    b.aabb(
      -w / 2 - 0.04,
      -0.04,
      -0.01,
      w / 2 + 0.04,
      h,
      0.012,
      WHITE,
      "base",
      m
    );
    b.disc(m, 0, h, 0.001, w / 2 + 0.04, 0.012, WHITE, 12);
    b.aabb(-w / 2, 0, 0, w / 2, h, 0.02, "#ffd88a", "glow", m);
    b.disc(m, 0, h, 0.012, w / 2, 0.016, "#ffd88a", 12, "glow");
    b.aabb(
      -w / 2 - 0.06,
      -0.07,
      0,
      w / 2 + 0.06,
      -0.03,
      0.06,
      WHITE,
      "base",
      m
    );
  };
  for (const x of [-0.64, 0.64]) archWindow(T(x, 0.5, 0.525), 0.2, 0.5);
  for (const side of [-1, 1])
    for (const z of [-0.45, 0.1])
      archWindow(chain(T(side * 0.865, 0.45, z), Ry(side * 90)), 0.26, 0.55);
  archWindow(chain(T(0, 0.4, -0.865), Ry(180)), 0.8, 0.7);
  // Flower boxes under the side windows.
  for (const side of [-1, 1])
    for (const z of [-0.45, 0.1]) {
      const m = chain(T(side * 0.91, 0.32, z), Ry(side * 90));
      b.aabb(-0.17, 0, -0.05, 0.17, 0.08, 0.05, WOOD, "base", m);
      for (const [u, c] of [
        [-0.11, "#e2742f"],
        [0, "#f0b13a"],
        [0.11, "#c9452c"],
      ])
        b.ico(chain(m, T(u, 0.11, 0), S(0.055)), c);
    }
  return b;
}

function studio() {
  const b = new Builder();
  const WHITE = "#f1efe8";
  const STEEL = "#3b3f45";
  const GLASS = "#9fd3e6";
  // Concrete plinth with a step at the door.
  b.aabb(-0.98, 0, -0.9, 0.98, 0.12, 0.72, "#d2cfc6");
  b.aabb(-0.35, 0, 0.72, 0.35, 0.06, 0.9, "#c6c2b8");
  // Ground floor: timber-clad back and side walls with vertical battens.
  b.aabb(-0.86, 0.12, -0.82, 0.86, 1.22, -0.7, WOOD_LIGHT);
  for (const x of [-0.86, 0.86])
    b.aabb(x - 0.06, 0.12, -0.82, x + 0.06, 1.22, 0.6, WOOD_LIGHT);
  for (let z = -0.7; z < 0.6; z += 0.16)
    for (const x of [-0.925, 0.925])
      b.aabb(x - 0.008, 0.12, z, x + 0.008, 1.22, z + 0.03, "#a87d4c");
  // Full-height glass front with vertical mullions only.
  b.aabb(-0.8, 0.12, 0.52, 0.8, 1.22, 0.56, GLASS, "glass");
  b.aabb(-0.82, 0.12, 0.5, 0.82, 0.16, 0.6, STEEL);
  b.aabb(-0.82, 1.18, 0.5, 0.82, 1.22, 0.6, STEEL);
  for (const x of [-0.8, -0.47, -0.16, 0.24, 0.55, 0.8])
    b.aabb(x - 0.018, 0.16, 0.52, x + 0.018, 1.18, 0.6, STEEL);
  // Warm interior seen through the glass: a desk, a lamp and a model on a plinth.
  b.aabb(-0.8, 0.12, -0.7, 0.8, 0.14, 0.5, "#cdb79a");
  b.aabb(-0.7, 0.14, -0.55, -0.2, 0.5, -0.3, WOOD);
  b.aabb(-0.66, 0.5, -0.5, -0.4, 0.53, -0.36, "#e8eef5");
  b.aabb(-0.32, 0.5, -0.46, -0.26, 0.74, -0.4, STEEL);
  b.ico(chain(T(-0.29, 0.78, -0.43), S(0.07)), "#ffd88a", "glow");
  b.aabb(0.3, 0.14, -0.4, 0.6, 0.55, -0.1, WHITE);
  b.aabb(0.36, 0.55, -0.34, 0.5, 0.72, -0.2, "#f7f7f2");
  b.aabb(0.42, 0.72, -0.3, 0.48, 0.9, -0.24, "#f7f7f2");
  b.aabb(-0.82, 1.08, -0.7, 0.82, 1.14, 0.5, "#ffe6b0", "glow");
  // Cantilevered white upper volume with a ribbon window, shifted forward and to the left.
  b.aabb(-1.0, 1.22, -0.78, 0.62, 2.0, 0.9, WHITE);
  b.aabb(-0.92, 1.45, 0.9, 0.5, 1.78, 0.93, GLASS, "glass");
  b.aabb(-0.94, 1.43, 0.9, 0.52, 1.45, 0.95, STEEL);
  b.aabb(-0.94, 1.78, 0.9, 0.52, 1.8, 0.95, STEEL);
  b.aabb(-1.03, 1.5, -0.6, -1.0, 1.78, 0.6, GLASS, "glass");
  b.aabb(-1.0, 1.22, 0.86, 0.62, 1.26, 0.9, "#d9d6cd");
  // Slim steel column under the cantilever.
  b.aabb(-0.97, 0.12, 0.83, -0.92, 1.22, 0.88, STEEL);
  // Green roof with a skylight and a few shrubs; a low parapet.
  b.aabb(-0.98, 2.0, -0.76, 0.6, 2.06, 0.88, "#7cb35a");
  b.aabb(-1.0, 2.0, -0.78, 0.62, 2.1, -0.74, WHITE);
  b.aabb(-1.0, 2.0, 0.86, 0.62, 2.1, 0.9, WHITE);
  b.aabb(-1.0, 2.0, -0.78, -0.96, 2.1, 0.9, WHITE);
  b.aabb(0.58, 2.0, -0.78, 0.62, 2.1, 0.9, WHITE);
  b.aabb(0.05, 2.06, -0.4, 0.45, 2.16, 0.1, GLASS, "glass");
  for (const [x, z, r, c] of [
    [-0.7, -0.45, 0.14, "#5e9a45"],
    [-0.45, 0.55, 0.11, "#6fae52"],
    [-0.72, 0.35, 0.1, "#f2a7c3"],
    [0.35, 0.6, 0.1, "#5e9a45"],
  ])
    b.ico(chain(T(x, 2.08, z), S(r, r * 0.8, r)), c);
  // Low roof over the right-hand ground floor bay.
  b.aabb(0.62, 1.22, -0.84, 0.96, 1.3, 0.66, WHITE);
  return b;
}

function draftingTable() {
  const b = new Builder();
  const k = 0.55;
  const s = (p) => p.map((v) => v * k);
  const STEEL = "#3b3f45";
  for (const x of [-0.5, 0.5]) {
    b.aabb(...s([x - 0.03, 0, -0.04]), ...s([x + 0.03, 0.95, 0.04]), STEEL);
    b.aabb(...s([x - 0.05, 0, -0.38]), ...s([x + 0.05, 0.05, 0.38]), STEEL);
  }
  b.aabb(...s([-0.47, 0.22, -0.03]), ...s([0.47, 0.27, 0.03]), STEEL);
  // The tilted drawing board facing +z, with a plan pinned to it and a ruler.
  const m = chain(S(k), T(0, 0.95, 0), Rx(-62));
  b.aabb(-0.62, -0.42, -0.05, 0.62, 0.42, 0, WOOD_LIGHT, "base", m);
  const pm = chain(m, T(0.05, -0.36, 0));
  b.aabb(-0.42, 0, 0, 0.42, 0.7, 0.006, "#f6f2e8", "base", pm);
  paint(b, chain(pm, T(0, 0.02, 0.006)), 0.78, 0.66, "plan");
  b.aabb(-0.6, -0.42, 0, 0.6, -0.36, 0.03, "#2f2f33", "base", m);
  b.prism(
    chain(m, T(0.48, -0.3, 0.012), S(0.18, 0.2, 0.012)),
    "#7fc2d8",
    "base",
    -0.5
  );
  b.aabb(-0.55, -0.36, 0.03, -0.25, -0.34, 0.05, "#e4b33d", "base", m);
  return b;
}

function bench() {
  const b = new Builder();
  const k = 0.5;
  const s = (p) => p.map((v) => v * k);
  const IRON = "#2f3236";
  // Solid cast-iron side frames.
  for (const x of [-0.72, 0.72]) {
    b.aabb(...s([x - 0.04, 0, -0.24]), ...s([x + 0.04, 0.45, 0.22]), IRON);
    b.beam(s([x, 0.42, -0.2]), s([x, 0.9, -0.3]), 0.08 * k, IRON);
  }
  for (const z of [-0.18, -0.03, 0.12])
    b.aabb(...s([-0.85, 0.42, z - 0.065]), ...s([0.85, 0.48, z + 0.065]), WOOD);
  for (const y of [0.6, 0.78]) {
    const p0 = s([-0.85, y, -0.24 - (y - 0.45) * 0.2]);
    const p1 = s([0.85, y, -0.24 - (y - 0.45) * 0.2]);
    b.beam(p0, p1, 0.12 * k, WOOD, 0.04 * k);
  }
  return b;
}

function leaves(seed, count, radius, palette, size = 0.09) {
  const b = new Builder();
  let x = seed;
  const rnd = () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * radius;
    const c = palette[Math.floor(rnd() * palette.length)];
    const sz = size * (0.7 + rnd() * 0.6);
    // A leaf is a flat diamond (a squashed, rotated square), lying almost flat.
    b.box(
      chain(
        T(Math.cos(a) * r, 0.012 + rnd() * 0.012, Math.sin(a) * r),
        Ry(rnd() * 360),
        Rx((rnd() - 0.5) * 16),
        S(sz * 0.55, 0.008, sz),
        Ry(45)
      ),
      c
    );
  }
  return b;
}

function hayBale() {
  const b = new Builder();
  const m = chain(T(0, 0.3, 0), Rz(90), T(0, -0.28, 0), S(0.3, 0.56, 0.3));
  b.cyl(m, 12, "#e2bf5c");
  for (const y of [0.15, 0.85])
    b.cyl(
      chain(
        T(0, 0.3, 0),
        Rz(90),
        T(0, -0.28 + 0.56 * y - 0.01, 0),
        S(0.305, 0.02, 0.305)
      ),
      12,
      "#c99f3f"
    );
  return b;
}

function sculptureSpiral() {
  const b = new Builder();
  b.aabb(-0.28, 0, -0.28, 0.28, 0.32, 0.28, STONE);
  b.aabb(-0.31, 0.32, -0.31, 0.31, 0.37, 0.31, "#d4c9b5");
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const s = 0.34 - t * 0.2;
    b.box(
      chain(T(0, 0.43 + i * 0.105, 0), Ry(i * 13), S(s, 0.1, s)),
      i % 2 ? "#c8693a" : "#d9893b"
    );
  }
  b.ico(chain(T(0, 1.42, 0), S(0.09)), "#f0b13a");
  return b;
}

function paintPots() {
  const b = new Builder();
  const pots = [
    [0, 0, "#c8412f"],
    [0.13, 0.05, "#2e5c9a"],
    [0.05, 0.14, "#f2c53d"],
    [-0.1, 0.1, "#3f8f5a"],
  ];
  for (const [x, z, c] of pots) {
    b.cyl(chain(T(x, 0, z), S(0.055, 0.1, 0.055)), 10, "#b9bcc2");
    b.cyl(chain(T(x, 0.1, z), S(0.05, 0.008, 0.05)), 10, c);
  }
  // A brush resting across one pot's rim (one stick, nothing crossing it).
  b.beam([-0.02, 0.12, -0.05], [0.12, 0.13, 0.08], 0.012, WOOD);
  b.beam([0.12, 0.13, 0.08], [0.15, 0.13, 0.11], 0.018, "#c8412f");
  return b;
}

function planter() {
  const b = new Builder();
  const k = 0.55;
  b.aabb(-0.8 * k, 0, -0.24 * k, 0.8 * k, 0.4 * k, 0.24 * k, WOOD);
  b.aabb(
    -0.82 * k,
    0.36 * k,
    -0.26 * k,
    0.82 * k,
    0.42 * k,
    0.26 * k,
    WOOD_DARK
  );
  b.aabb(-0.76 * k, 0.4 * k, -0.2 * k, 0.76 * k, 0.43 * k, 0.2 * k, "#5a3d2a");
  const colors = [
    "#f2a7c3",
    "#ffffff",
    "#f7d154",
    "#c9a0e0",
    "#e98bb0",
    "#ffd6e3",
  ];
  let i = 0;
  for (let x = -0.66; x <= 0.67; x += 0.19) {
    for (const z of [-0.08, 0.09]) {
      const dx = (i % 3) * 0.03 - 0.03;
      const h = 0.55 + ((i * 7) % 5) * 0.04;
      b.ico(
        chain(
          T((x + dx) * k, 0.48 * k, z * k),
          S(0.09 * k, 0.07 * k, 0.09 * k)
        ),
        "#5e9a45"
      );
      b.aabb(
        (x + dx - 0.012) * k,
        0.43 * k,
        (z - 0.012) * k,
        (x + dx + 0.012) * k,
        h * k,
        (z + 0.012) * k,
        "#4f8a3a"
      );
      b.ico(
        chain(T((x + dx) * k, h * k, z * k), S(0.075 * k)),
        colors[i % colors.length]
      );
      i++;
    }
  }
  return b;
}

/** A loose clump of round blooms on short stems with a few leaves (spring meadow). */
function blooms(seed, palette, count = 9, radius = 0.32) {
  const b = new Builder();
  let x = seed;
  const rnd = () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * radius * 0.8;
    b.ico(
      chain(T(Math.cos(a) * r, 0.03, Math.sin(a) * r), S(0.09, 0.05, 0.09)),
      i % 2 ? "#5e9a45" : "#6fae52"
    );
  }
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * radius;
    const px = Math.cos(a) * r;
    const pz = Math.sin(a) * r;
    const h = 0.1 + rnd() * 0.1;
    b.aabb(px - 0.008, 0, pz - 0.008, px + 0.008, h, pz + 0.008, "#4f8a3a");
    const c = palette[Math.floor(rnd() * palette.length)];
    b.ico(chain(T(px, h, pz), S(0.04, 0.032, 0.04)), c);
    b.ico(chain(T(px, h + 0.022, pz), S(0.014)), "#fff3b0");
  }
  return b;
}

function maquette() {
  const b = new Builder();
  const W = "#f7f7f2";
  b.aabb(-0.22, 0, -0.22, 0.22, 0.5, 0.22, "#d8d4ca");
  b.aabb(-0.25, 0.5, -0.25, 0.25, 0.54, 0.25, "#cbc6ba");
  b.aabb(-0.2, 0.54, -0.2, 0.2, 0.56, 0.2, "#a8cf8c");
  b.aabb(-0.16, 0.56, -0.12, 0.06, 0.66, 0.1, W);
  b.aabb(-0.06, 0.66, -0.15, 0.15, 0.74, 0.05, W);
  b.aabb(0.06, 0.56, 0.02, 0.12, 0.86, 0.08, W);
  b.aabb(-0.15, 0.66, 0.0, -0.05, 0.69, 0.1, "#9fd3e6");
  for (const [x, z] of [
    [0.13, -0.13],
    [-0.13, 0.14],
  ])
    b.ico(chain(T(x, 0.6, z), S(0.035)), "#6fae52");
  return b;
}

const AUTUMN = ["#c9452c", "#e2742f", "#f0b13a", "#a8552f", "#d9893b"];
const PETALS = ["#f2a7c3", "#f7c6d8", "#ffffff", "#e98bb0"];

/** name -> [builder, manifest extras] */
const MODELS = {
  "c-gallery": [
    gallery,
    {
      kind: "building",
      footprint: [1, 1],
      footprintUnit: "hex",
      tags: ["gallery", "brick", "saleh", "museum"],
    },
  ],
  "c-studio": [
    studio,
    {
      kind: "building",
      footprint: [1, 1],
      footprintUnit: "hex",
      tags: ["studio", "architecture", "glass", "eyad"],
    },
  ],
  "c-easel-autumn": [
    () => easel("autumn"),
    { kind: "prop", tags: ["easel", "painting", "art", "saleh"] },
  ],
  "c-easel-sea": [
    () => easel("sea"),
    { kind: "prop", tags: ["easel", "painting", "art", "saleh"] },
  ],
  "c-easel-abstract": [
    () => easel("abstract"),
    { kind: "prop", tags: ["easel", "painting", "art", "saleh"] },
  ],
  "c-easel-blossom": [
    () => easel("blossom"),
    { kind: "prop", tags: ["easel", "painting", "art", "eyad"] },
  ],
  "c-easel-blueprint": [
    () => easel("blueprint"),
    { kind: "prop", tags: ["easel", "blueprint", "architecture", "eyad"] },
  ],
  "c-frame-autumn": [
    () => frameStand("autumn"),
    { kind: "prop", tags: ["painting", "frame", "art", "saleh"] },
  ],
  "c-frame-abstract": [
    () => frameStand("abstract"),
    { kind: "prop", tags: ["painting", "frame", "art", "saleh"] },
  ],
  "c-drafting-table": [
    draftingTable,
    { kind: "prop", tags: ["drafting", "table", "architecture", "eyad"] },
  ],
  "c-bench": [bench, { kind: "prop", tags: ["bench", "seat", "park"] }],
  "c-leaves-decal-a": [
    () => leaves(7, 46, 0.85, AUTUMN),
    {
      kind: "terrain",
      overlay: true,
      walkable: true,
      solid: false,
      tags: ["leaves", "autumn", "decal", "saleh"],
    },
  ],
  "c-leaves-decal-b": [
    () => leaves(23, 22, 0.5, AUTUMN),
    {
      kind: "terrain",
      overlay: true,
      walkable: true,
      solid: false,
      tags: ["leaves", "autumn", "decal", "saleh"],
    },
  ],
  "c-petals-decal": [
    () => leaves(41, 34, 0.8, PETALS, 0.06),
    {
      kind: "terrain",
      overlay: true,
      walkable: true,
      solid: false,
      tags: ["petals", "blossom", "spring", "decal", "eyad"],
    },
  ],
  "c-hay-bale": [
    hayBale,
    { kind: "prop", tags: ["hay", "autumn", "farm", "saleh"] },
  ],
  "c-sculpture-spiral": [
    sculptureSpiral,
    { kind: "prop", tags: ["statue", "sculpture", "art", "saleh"] },
  ],
  "c-paint-pots": [
    paintPots,
    { kind: "prop", solid: false, tags: ["paint", "art", "saleh"] },
  ],
  "c-raised-bed": [
    planter,
    { kind: "prop", tags: ["raised-bed", "blooms", "spring", "eyad"] },
  ],
  "c-blooms-pink": [
    () => blooms(5, ["#f2a7c3", "#f7c6d8", "#ffffff", "#e98bb0"]),
    {
      kind: "nature",
      solid: false,
      tags: ["blooms", "spring", "meadow", "eyad"],
    },
  ],
  "c-blooms-mixed": [
    () => blooms(17, ["#f7d154", "#c9a0e0", "#e85d5d", "#ffffff", "#f2a7c3"]),
    {
      kind: "nature",
      solid: false,
      tags: ["blooms", "spring", "meadow", "eyad"],
    },
  ],
  "c-blooms-tulips": [
    () => blooms(29, ["#e85d5d", "#f7d154", "#f2a7c3"], 14, 0.4),
    {
      kind: "nature",
      solid: false,
      tags: ["blooms", "tulips", "spring", "eyad"],
    },
  ],
  "c-maquette": [
    maquette,
    { kind: "prop", tags: ["architecture", "model", "plinth", "eyad"] },
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
