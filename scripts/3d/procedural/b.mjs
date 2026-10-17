#!/usr/bin/env node
/**
 * Group "b" procedural models (civicmind + onyx islands): flat-shaded low-poly glbs built
 * from boxes, prisms, cones and spheres, one material per colour. Writes
 * public/game3d/models/b-<name>.glb and registers them in public/game3d/models/custom-b.json.
 *
 *   node scripts/3d/procedural/b.mjs
 *
 * Rules: no cross shapes anywhere (no crossing beams, no X bracing, plain ball finials).
 */

import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";

const OUT = path.join(process.cwd(), "public", "game3d", "models");
const FRAGMENT = path.join(OUT, "custom-b.json");

// ---------------------------------------------------------------- colours

function lin(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

/** name -> { color, emissive?, strength?, rough?, metal? } */
const PALETTE = {
  stone: { color: "#a7adb5" },
  stoneLight: { color: "#d3d5d8" },
  stoneDark: { color: "#7d848e" },
  cream: { color: "#efe4cc" },
  roofBlue: { color: "#3f73bd" },
  trimBlue: { color: "#2d5592" },
  wood: { color: "#8a5a3b" },
  woodDark: { color: "#5e3b27" },
  gold: { color: "#e2b54b", rough: 0.45, metal: 0.35 },
  goldDeep: { color: "#b98a2c", rough: 0.5, metal: 0.3 },
  white: { color: "#f7f4ec" },
  ink: { color: "#26262e" },
  glassWarm: { color: "#ffd98a", emissive: "#ffb546", strength: 0.9 },
  crystal: { color: "#7ff4ff", emissive: "#3fe0ff", strength: 1.6, rough: 0.2 },
  crystalViolet: {
    color: "#c7a6ff",
    emissive: "#9a6bff",
    strength: 1.3,
    rough: 0.2,
  },
  iron: { color: "#3a3f4a", rough: 0.6, metal: 0.3 },
  onyx: { color: "#1d1c22", rough: 0.55 },
  onyxSoft: { color: "#2e2c35", rough: 0.6 },
  sand: { color: "#e8cf98" },
  sandDark: { color: "#d5b57a" },
  sandSide: { color: "#c49a62" },
  soil: { color: "#6b4a33" },
  leaf: { color: "#5c9a4a" },
  leafDark: { color: "#467e3a" },
  petalRed: { color: "#e2574c" },
  petalYellow: { color: "#f3cd4b" },
  petalPink: { color: "#f19ac0" },
  petalWhite: { color: "#fbf6ee" },
  rugRed: { color: "#b8423a" },
  rugTeal: { color: "#2f8f8a" },
  rugCream: { color: "#f0dfb8" },
  rugIndigo: { color: "#384a8f" },
  canvasCream: { color: "#f3e7c9" },
  terracotta: { color: "#c8744a" },
  terracottaDark: { color: "#a65a36" },
  lampGlow: { color: "#ffe2a0", emissive: "#ffb347", strength: 1.8 },
};

// ---------------------------------------------------------------- geometry builder

class Builder {
  constructor() {
    /** material name -> flat array of positions (3 per vertex, 3 vertices per triangle) */
    this.tris = new Map();
    this.xf = [(p) => p];
  }

  /** Run fn with an extra transform (applied to points before the current ones). */
  with(t, fn) {
    const outer = this.xf[this.xf.length - 1];
    this.xf.push((p) => outer(t(p)));
    fn();
    this.xf.pop();
  }

  tp(p) {
    return this.xf[this.xf.length - 1](p);
  }

  /** Triangle, oriented so its normal points away from `center` (both in local space). */
  tri(mat, a, b, c, center) {
    let A = this.tp(a);
    let B = this.tp(b);
    let C = this.tp(c);
    const n = cross(sub(B, A), sub(C, A));
    if (center) {
      const ctr = this.tp(center);
      const m = [
        (A[0] + B[0] + C[0]) / 3,
        (A[1] + B[1] + C[1]) / 3,
        (A[2] + B[2] + C[2]) / 3,
      ];
      if (dot(n, sub(m, ctr)) < 0) [B, C] = [C, B];
    }
    if (!PALETTE[mat]) throw new Error(`unknown material ${mat}`);
    let list = this.tris.get(mat);
    if (!list) this.tris.set(mat, (list = []));
    list.push(...A, ...B, ...C);
  }

  quad(mat, a, b, c, d, center) {
    this.tri(mat, a, b, c, center);
    this.tri(mat, a, c, d, center);
  }

  /** Axis-aligned box: centre x/z, bottom y0. Optional rotation around y (degrees). */
  box(mat, cx, y0, cz, w, h, d, rotY = 0) {
    const hw = w / 2;
    const hd = d / 2;
    const r = (rotY * Math.PI) / 180;
    const P = (x, y, z) => {
      const c = Math.cos(r);
      const s = Math.sin(r);
      return [cx + x * c + z * s, y, cz - x * s + z * c];
    };
    const v = [
      P(-hw, y0, -hd),
      P(hw, y0, -hd),
      P(hw, y0, hd),
      P(-hw, y0, hd),
      P(-hw, y0 + h, -hd),
      P(hw, y0 + h, -hd),
      P(hw, y0 + h, hd),
      P(-hw, y0 + h, hd),
    ];
    const ctr = [cx, y0 + h / 2, cz];
    const f = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ];
    for (const [a, b, c, d] of f) this.quad(mat, v[a], v[b], v[c], v[d], ctr);
  }

  /** n-sided frustum / cylinder / cone along +y. rTop 0 makes a cone. rot0 in degrees. */
  prism(mat, cx, y0, cz, rBot, rTop, h, n = 8, rot0 = 0, caps = true) {
    const ring = (r, y) =>
      Array.from({ length: n }, (_, i) => {
        const a = ((rot0 + (360 * i) / n) * Math.PI) / 180;
        return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
      });
    const b = ring(rBot, y0);
    const t = ring(rTop, y0 + h);
    const ctr = [cx, y0 + h / 2, cz];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (rTop <= 1e-6) this.tri(mat, b[i], b[j], [cx, y0 + h, cz], ctr);
      else if (rBot <= 1e-6) this.tri(mat, [cx, y0, cz], t[j], t[i], ctr);
      else this.quad(mat, b[i], b[j], t[j], t[i], ctr);
    }
    if (caps) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (rBot > 1e-6)
          this.tri(mat, [cx, y0, cz], b[i], b[j], [cx, y0 + h, cz]);
        if (rTop > 1e-6)
          this.tri(mat, [cx, y0 + h, cz], t[i], t[j], [cx, y0, cz]);
      }
    }
  }

  /** Low-poly (hemi)sphere centred at (cx, cy, cz). */
  sphere(mat, cx, cy, cz, r, seg = 8, rings = 5, hemi = false, sy = 1) {
    const lat0 = hemi ? 0 : -Math.PI / 2;
    const pt = (i, k) => {
      const lat = lat0 + ((Math.PI / 2 - lat0) * k) / rings;
      const lon = (2 * Math.PI * i) / seg;
      return [
        cx + r * Math.cos(lat) * Math.cos(lon),
        cy + r * sy * Math.sin(lat),
        cz + r * Math.cos(lat) * Math.sin(lon),
      ];
    };
    const ctr = [cx, cy, cz];
    for (let k = 0; k < rings; k++) {
      for (let i = 0; i < seg; i++) {
        const a = pt(i, k);
        const b = pt(i + 1, k);
        const c = pt(i + 1, k + 1);
        const d = pt(i, k + 1);
        if (k === rings - 1) this.tri(mat, a, b, c, ctr);
        else if (!hemi && k === 0) this.tri(mat, a, c, d, ctr);
        else this.quad(mat, a, b, c, d, ctr);
      }
    }
  }

  /** Hip roof over a w x d rectangle, rising h, ridge along x of length ridge. */
  hipRoof(mat, cx, y0, cz, w, d, h, ridge) {
    const hw = w / 2;
    const hd = d / 2;
    const a = [cx - hw, y0, cz - hd];
    const b = [cx + hw, y0, cz - hd];
    const c = [cx + hw, y0, cz + hd];
    const e = [cx - hw, y0, cz + hd];
    const r1 = [cx - ridge / 2, y0 + h, cz];
    const r2 = [cx + ridge / 2, y0 + h, cz];
    const ctr = [cx, y0 + h * 0.3, cz];
    this.quad(mat, a, b, r2, r1, ctr);
    this.quad(mat, c, e, r1, r2, ctr);
    this.tri(mat, b, c, r2, ctr);
    this.tri(mat, e, a, r1, ctr);
    this.quad(mat, a, b, c, e, [cx, y0 + 1, cz]);
  }

  /** Triangular gable prism (pediment) facing +z: base width w, height h, depth d. */
  gable(mat, cx, y0, cz, w, h, d) {
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    const L = [cx - w / 2, y0];
    const R = [cx + w / 2, y0];
    const T = [cx, y0 + h];
    const ctr = [cx, y0 + h / 3, cz];
    const p = (q, z) => [q[0], q[1], z];
    this.tri(mat, p(L, z1), p(R, z1), p(T, z1), ctr);
    this.tri(mat, p(L, z0), p(R, z0), p(T, z0), ctr);
    this.quad(mat, p(L, z0), p(R, z0), p(R, z1), p(L, z1), ctr);
    this.quad(mat, p(R, z0), p(T, z0), p(T, z1), p(R, z1), ctr);
    this.quad(mat, p(T, z0), p(L, z0), p(L, z1), p(T, z1), ctr);
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Rotation around y (degrees) then translation. */
const rotY = (deg, tx = 0, ty = 0, tz = 0) => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return (p) => [tx + p[0] * c + p[2] * s, ty + p[1], tz - p[0] * s + p[2] * c];
};

/** Rotation around x (degrees): +90 turns +y into +z. */
const rotX = (deg) => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return (p) => [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
};

const compose =
  (...fs) =>
  (p) =>
    fs.reduceRight((acc, f) => f(acc), p);

/** Rotate around z (degrees) in the x/y plane. */
const rotZ = (deg) => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
};

// ---------------------------------------------------------------- shared parts

/**
 * A clock face in the x/y plane facing +z, centred at the origin: white disc, gold rim,
 * twelve equal dots and hands at ten past ten (a V, never a cross).
 */
function clockFace(b, r) {
  b.with(rotX(90), () => {
    // Disc lies in the x/z plane after rotX(90) maps +y to +z; build along y.
    b.prism("goldDeep", 0, -0.06, 0, r * 1.12, r * 1.12, 0.08, 16, 0);
    b.prism("white", 0, 0.02, 0, r, r, 0.03, 16, 0);
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(
      "ink",
      Math.cos(a) * r * 0.82,
      Math.sin(a) * r * 0.82 - 0.03,
      0.06,
      0.06,
      0.06,
      0.03
    );
  }
  // Hour hand to 10, minute hand to 2: both from the centre, forming a V.
  const hand = (deg, len, wdt) =>
    b.with(compose(rotZ(deg)), () =>
      b.box("ink", 0, 0, 0.075, wdt, len, 0.025)
    );
  hand(60, r * 0.5, 0.07); // pointing up-left (10 o'clock)
  hand(-60, r * 0.75, 0.05); // pointing up-right (2 o'clock)
  b.with(rotX(90), () => b.prism("gold", 0, 0.07, 0, 0.05, 0.05, 0.04, 8));
}

/** A plain ball finial on a short rod, base at y0. */
function ballFinial(b, x, y0, z, r = 0.14, mat = "gold") {
  b.prism(mat, x, y0, z, 0.06, 0.05, r * 1.6, 6);
  b.sphere(mat, x, y0 + r * 1.6 + r * 0.85, z, r, 10, 6);
}

/** A window: frame plus glowing pane on the +z face of a wall at z. */
function windowFront(
  b,
  x,
  y0,
  z,
  w,
  h,
  frame = "stoneLight",
  pane = "glassWarm"
) {
  b.box(frame, x, y0 - 0.04, z + 0.02, w + 0.1, h + 0.1, 0.06);
  b.box(pane, x, y0, z + 0.05, w, h, 0.04);
}

// ---------------------------------------------------------------- civicmind models

function townHall() {
  const b = new Builder();
  // Plinth and front steps.
  b.box("stoneLight", 0, 0, -0.1, 4.4, 0.3, 2.8);
  b.box("stoneLight", 0, 0, 1.45, 1.9, 0.2, 0.3);
  b.box("stoneLight", 0, 0, 1.65, 1.9, 0.1, 0.25);
  // Main hall.
  b.box("cream", 0, 0.3, -0.2, 3.9, 1.75, 2.3);
  b.box("stone", 0, 0.3, -0.2, 3.98, 0.32, 2.38);
  b.box("stone", 0, 2.02, -0.2, 4.15, 0.16, 2.55);
  for (const x of [-1.85, 1.85])
    for (const z of [-1.25, 0.85]) b.box("stone", x, 0.3, z, 0.24, 1.75, 0.24);
  b.hipRoof("roofBlue", 0, 2.18, -0.2, 4.15, 2.55, 0.85, 2.0);
  // Front windows either side of the portico, and side windows.
  for (const x of [-1.35, -0.85, 0.85, 1.35])
    windowFront(b, x, 0.85, 0.95, 0.3, 0.6);
  for (const side of [-1, 1])
    b.with(rotY(side * 90), () => {
      for (const x of [-0.5, 0.3]) windowFront(b, x, 0.85, 1.95, 0.32, 0.6);
    });
  // Portico: columns, entablature, pediment, door.
  b.box("woodDark", 0, 0.3, 0.97, 0.6, 0.95, 0.06);
  b.box("gold", 0, 1.25, 0.99, 0.66, 0.06, 0.05);
  b.box("stoneLight", 0, 0.3, 1.15, 1.9, 0.08, 0.6);
  for (const x of [-0.8, -0.27, 0.27, 0.8]) {
    b.prism("stoneLight", x, 0.38, 1.25, 0.1, 0.1, 0.06, 8, 22.5);
    b.prism("white", x, 0.44, 1.25, 0.08, 0.075, 1.36, 8, 22.5);
    b.box("stoneLight", x, 1.8, 1.25, 0.2, 0.06, 0.2);
  }
  b.box("cream", 0, 1.86, 1.08, 2.0, 0.2, 0.55);
  b.box("trimBlue", 0, 1.9, 1.36, 1.7, 0.08, 0.02);
  b.gable("roofBlue", 0, 2.06, 1.1, 2.1, 0.45, 0.6);
  b.gable("cream", 0, 2.09, 1.12, 1.8, 0.33, 0.6);
  // Clock tower rising from the back of the hall.
  const tz = -0.55;
  b.box("cream", 0, 2.0, tz, 1.3, 2.3, 1.3);
  for (const x of [-0.6, 0.6])
    for (const z of [tz - 0.6, tz + 0.6])
      b.box("stone", x, 2.0, z, 0.18, 2.3, 0.18);
  b.box("stone", 0, 4.3, tz, 1.5, 0.14, 1.5);
  b.box("cream", 0, 4.44, tz, 1.4, 1.05, 1.4);
  b.box("stone", 0, 5.49, tz, 1.55, 0.14, 1.55);
  for (let k = 0; k < 4; k++)
    b.with(rotY(k * 90, 0, 0, tz), () =>
      b.with(
        (p) => [p[0], p[1] + 4.97, p[2] + 0.71],
        () => clockFace(b, 0.42)
      )
    );
  // Tall windows on the tower shaft.
  for (let k = 0; k < 4; k++)
    b.with(rotY(k * 90, 0, 0, tz), () =>
      windowFront(b, 0, 3.05, 0.65, 0.22, 0.75, "stone")
    );
  // Belfry: four corner posts under a slab, then the roof and the plain ball finial.
  for (const x of [-0.55, 0.55])
    for (const z of [tz - 0.55, tz + 0.55])
      b.box("white", x, 5.63, z, 0.16, 0.62, 0.16);
  b.box("gold", 0, 5.63, tz, 0.3, 0.42, 0.3);
  b.box("stone", 0, 6.25, tz, 1.5, 0.12, 1.5);
  b.prism("roofBlue", 0, 6.37, tz, 1.08, 0, 1.15, 4, 45);
  ballFinial(b, 0, 7.45, tz, 0.15);
  return b;
}

function crystalLamp() {
  const b = new Builder();
  b.prism("stoneDark", 0, 0, 0, 0.2, 0.17, 0.16, 6);
  b.prism("iron", 0, 0.16, 0, 0.055, 0.045, 1.35, 6);
  b.prism("iron", 0, 1.48, 0, 0.1, 0.16, 0.1, 6);
  // Crystal: an elongated octahedron held by three short prongs (no crossing bars).
  b.prism("crystal", 0, 1.58, 0, 0.0, 0.13, 0.2, 6, 0);
  b.prism("crystal", 0, 1.78, 0, 0.13, 0.0, 0.32, 6, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.box(
      "iron",
      Math.cos(a) * 0.15,
      1.56,
      Math.sin(a) * 0.15,
      0.03,
      0.22,
      0.03
    );
  }
  return b;
}

function crystalCluster() {
  const b = new Builder();
  b.prism("stoneDark", 0, 0, 0, 0.42, 0.32, 0.16, 7, 10);
  const spikes = [
    [0, 0, 0.12, 0.95, "crystal"],
    [0.2, 0.08, 0.08, 0.6, "crystalViolet"],
    [-0.18, 0.12, 0.08, 0.5, "crystal"],
    [0.05, -0.2, 0.07, 0.45, "crystalViolet"],
    [-0.12, -0.12, 0.06, 0.38, "crystal"],
  ];
  for (const [x, z, r, h, m] of spikes) {
    b.prism(m, x, 0.12, z, r, r * 0.8, h * 0.7, 6, 15);
    b.prism(m, x, 0.12 + h * 0.7, z, r * 0.8, 0, h * 0.3, 6, 15);
  }
  return b;
}

function planter() {
  const b = new Builder();
  b.box("stoneLight", 0, 0, 0, 1.2, 0.22, 0.5);
  b.box("soil", 0, 0.22, 0, 1.08, 0.03, 0.38);
  const petals = ["petalRed", "petalYellow", "petalPink", "petalWhite"];
  let k = 0;
  for (let i = 0; i < 6; i++) {
    for (const z of [-0.09, 0.09]) {
      const x = -0.45 + i * 0.18 + (z > 0 ? 0.07 : 0);
      b.prism("leaf", x, 0.24, z, 0.06, 0.03, 0.14, 5);
      b.sphere(petals[k++ % petals.length], x, 0.42, z, 0.065, 6, 3);
    }
  }
  return b;
}

function bench() {
  const b = new Builder();
  for (const x of [-0.45, 0.45]) b.box("iron", x, 0, 0, 0.06, 0.3, 0.32);
  b.box("wood", 0, 0.3, 0, 1.1, 0.05, 0.34);
  b.box("wood", 0, 0.42, -0.15, 1.1, 0.22, 0.04);
  for (const x of [-0.45, 0.45]) b.box("iron", x, 0.3, -0.16, 0.05, 0.36, 0.04);
  return b;
}

/** A civic notice pillar (round advertising column with a dome cap and ball finial). */
function noticeColumn() {
  const b = new Builder();
  b.prism("stone", 0, 0, 0, 0.32, 0.3, 0.12, 10);
  b.prism("trimBlue", 0, 0.12, 0, 0.26, 0.26, 1.2, 10);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 360;
    b.with(rotY(a), () => b.box("white", 0, 0.45, 0.26, 0.22, 0.5, 0.02));
  }
  b.prism("stone", 0, 1.32, 0, 0.32, 0.32, 0.06, 10);
  b.sphere("roofBlue", 0, 1.38, 0, 0.3, 10, 4, true, 0.7);
  ballFinial(b, 0, 1.58, 0, 0.07);
  return b;
}

// ---------------------------------------------------------------- onyx models

/** The black-and-gold boutique palace: arcade front, display windows, drum and dome. */
function palace() {
  const b = new Builder();
  // Terrace and steps.
  b.box("sandDark", 0, 0, -0.1, 4.6, 0.25, 3.2);
  b.box("sandDark", 0, 0, 1.6, 1.6, 0.16, 0.35);
  // Main block.
  b.box("onyx", 0, 0.25, -0.2, 4.0, 2.0, 2.5);
  b.box("gold", 0, 0.25, -0.2, 4.08, 0.12, 2.58);
  b.box("gold", 0, 2.2, -0.2, 4.2, 0.1, 2.7);
  b.box("onyxSoft", 0, 2.3, -0.2, 4.0, 0.26, 2.5);
  b.box("gold", 0, 2.56, -0.2, 4.15, 0.06, 2.65);
  // Parapet: a row of small gold-capped merlons (blocks, nothing pointed).
  for (let i = 0; i < 9; i++) {
    const x = -1.8 + i * 0.45;
    b.box("onyx", x, 2.62, 1.0, 0.24, 0.2, 0.12);
    b.box("onyx", x, 2.62, -1.4, 0.24, 0.2, 0.12);
  }
  // Front arcade: arched openings framed in gold with warm display windows.
  for (const x of [-1.45, -0.75, 0.75, 1.45]) {
    b.box("gold", x, 0.37, 1.06, 0.5, 1.3, 0.04);
    b.box("glassWarm", x, 0.45, 1.09, 0.38, 1.1, 0.03);
    b.sphere("gold", x, 1.67, 1.06, 0.25, 8, 3, true, 0.8);
  }
  // Grand door with a gold horseshoe-free round arch.
  b.box("gold", 0, 0.37, 1.07, 0.9, 1.6, 0.06);
  b.box("onyxSoft", 0, 0.37, 1.11, 0.7, 1.45, 0.04);
  b.box("goldDeep", 0, 0.37, 1.14, 0.03, 1.45, 0.02);
  b.sphere("gold", 0, 1.97, 1.07, 0.45, 10, 3, true, 0.6);
  // Side bays with display windows.
  for (const side of [-1, 1])
    b.with(rotY(side * 90), () => {
      for (const x of [-0.6, 0.4]) {
        b.box("gold", x, 0.45, 2.03, 0.5, 1.2, 0.04);
        b.box("glassWarm", x, 0.52, 2.06, 0.38, 1.05, 0.03);
      }
    });
  // Corner pavilions: square posts with flat gold caps.
  for (const x of [-1.95, 1.95])
    for (const z of [-1.4, 1.0]) {
      b.box("onyxSoft", x, 0.25, z, 0.4, 2.7, 0.4);
      b.box("gold", x, 2.95, z, 0.48, 0.1, 0.48);
      b.sphere("gold", x, 3.05, z, 0.14, 8, 4);
    }
  // Drum, dome and plain ball finial.
  const dz = -0.25;
  b.prism("onyxSoft", 0, 2.56, dz, 1.15, 1.15, 0.5, 16, 0);
  b.prism("gold", 0, 3.06, dz, 1.2, 1.2, 0.08, 16, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 360 + 22.5;
    b.with(rotY(a, 0, 0, dz), () =>
      b.box("glassWarm", 0, 2.66, 1.13, 0.16, 0.3, 0.04)
    );
  }
  b.sphere("gold", 0, 3.14, dz, 1.08, 16, 6, true, 1.05);
  b.prism("goldDeep", 0, 4.25, dz, 0.18, 0.12, 0.12, 8);
  ballFinial(b, 0, 4.35, dz, 0.18);
  // Gold banding on the dome (three thin rings).
  return b;
}

function sandHex() {
  // Matches the KayKit tile: 2 m across flats, top at y = 0, bottom at y = -1, pointy top.
  const b = new Builder();
  const R = 2 / Math.sqrt(3);
  b.prism("sandSide", 0, -1, 0, R, R, 0.94, 6, 30, false);
  b.prism("sand", 0, -0.06, 0, R, R, 0.06, 6, 30, true);
  // One soft, low dune in the same colour (flat shading alone makes it read).
  b.sphere("sand", 0.3, -0.02, -0.2, 0.42, 7, 2, true, 0.12);
  return b;
}

/** A paved hex tile (same frame as the KayKit tiles): a slab ring around a centre stone. */
function pavedHex(side, slabA, slabB, centre, inset = 0.62) {
  const b = new Builder();
  const R = 2 / Math.sqrt(3);
  b.prism(side, 0, -1, 0, R, R, 0.998, 6, 30, true);
  const corner = (r, i) => {
    const a = ((30 + 60 * i) * Math.PI) / 180;
    return [r * Math.cos(a), 0, r * Math.sin(a)];
  };
  const y = -0.06;
  const top = (p) => [p[0], y + 0.064, p[2]];
  const rIn = R * inset;
  const rOut = R * 0.985;
  // Outer ring: six slabs, alternating tones, split once more along each side.
  for (let i = 0; i < 6; i++) {
    const a0 = corner(rIn, i);
    const a1 = corner(rIn, i + 1);
    const b0 = corner(rOut, i);
    const b1 = corner(rOut, i + 1);
    const mid = (p, q) => [(p[0] + q[0]) / 2, 0, (p[2] + q[2]) / 2];
    const am = mid(a0, a1);
    const bm = mid(b0, b1);
    const ctr = [0, -1, 0];
    b.quad(i % 2 ? slabA : slabB, top(a0), top(am), top(bm), top(b0), ctr);
    b.quad(i % 2 ? slabB : slabA, top(am), top(a1), top(b1), top(bm), ctr);
  }
  // Centre stone, slightly raised so the seams read.
  b.prism(centre, 0, -0.02, 0, rIn * 0.96, rIn * 0.92, 0.035, 6, 30, true);
  return b;
}

function rug(primary, border, accent) {
  const b = new Builder();
  b.box(border, 0, 0, 0, 1.2, 0.02, 0.8);
  b.box(primary, 0, 0.02, 0, 1.05, 0.006, 0.65);
  for (const x of [-0.32, 0, 0.32])
    b.box(accent, x, 0.026, 0, 0.14, 0.004, 0.14, 45);
  for (const x of [-0.56, 0.56])
    for (let i = 0; i < 5; i++)
      b.box(
        border,
        x + Math.sign(x) * 0.04,
        0,
        -0.3 + i * 0.15,
        0.06,
        0.012,
        0.03
      );
  return b;
}

function goldLantern() {
  const b = new Builder();
  b.prism("onyx", 0, 0, 0, 0.16, 0.14, 0.08, 8);
  b.prism("onyx", 0, 0.08, 0, 0.04, 0.04, 1.1, 6);
  b.prism("gold", 0, 1.18, 0, 0.12, 0.14, 0.05, 8);
  b.prism("lampGlow", 0, 1.23, 0, 0.11, 0.11, 0.28, 8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.box(
      "gold",
      Math.cos(a) * 0.115,
      1.23,
      Math.sin(a) * 0.115,
      0.025,
      0.28,
      0.025
    );
  }
  b.prism("gold", 0, 1.51, 0, 0.15, 0.02, 0.2, 8);
  b.sphere("gold", 0, 1.73, 0, 0.04, 6, 3);
  return b;
}

/** A bazaar stall: four posts, a counter with goods, a striped black-and-gold awning. */
function bazaarStall() {
  const b = new Builder();
  for (const x of [-0.6, 0.6])
    for (const z of [-0.35, 0.35]) b.box("woodDark", x, 0, z, 0.07, 1.35, 0.07);
  b.box("wood", 0, 0, 0.3, 1.25, 0.6, 0.18);
  b.box("woodDark", 0, 0.6, 0.3, 1.32, 0.05, 0.25);
  // Goods on the counter: folded cloth stacks in brand colours.
  const goods = ["onyx", "gold", "rugRed", "rugTeal", "canvasCream"];
  goods.forEach((m, i) =>
    b.box(m, -0.5 + i * 0.25, 0.65, 0.3, 0.18, 0.07 + (i % 2) * 0.04, 0.16)
  );
  // Awning: alternating stripes, sloping down to the front.
  for (let i = 0; i < 8; i++) {
    const x = -0.7 + i * 0.2 + 0.1;
    b.with(
      (p) => {
        const z = p[2];
        return [p[0], p[1] + 1.35 + (0.5 - z) * 0.35 - 0.17, z];
      },
      () => b.box(i % 2 ? "gold" : "onyx", x, 0, 0.05, 0.2, 0.04, 1.05)
    );
  }
  // Scalloped valance at the front edge.
  for (let i = 0; i < 7; i++)
    b.sphere(
      i % 2 ? "onyx" : "gold",
      -0.6 + i * 0.2,
      1.37,
      0.58,
      0.08,
      6,
      2,
      true,
      -1
    );
  return b;
}

/** A desert pavilion: a round tented canopy on six slim posts over a rug. */
function pavilion() {
  const b = new Builder();
  b.prism("rugRed", 0, 0, 0, 0.9, 0.9, 0.02, 6, 30);
  b.prism("rugCream", 0, 0.02, 0, 0.72, 0.72, 0.005, 6, 30);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    b.prism(
      "gold",
      Math.cos(a) * 0.8,
      0,
      Math.sin(a) * 0.8,
      0.035,
      0.035,
      1.3,
      6
    );
  }
  b.prism("canvasCream", 0, 1.3, 0, 1.0, 0.0, 0.7, 12, 15);
  b.prism("gold", 0, 1.26, 0, 1.0, 1.0, 0.05, 12, 15);
  ballFinial(b, 0, 1.98, 0, 0.08);
  for (const [x, z, m] of [
    [-0.35, 0.1, "rugTeal"],
    [0.35, -0.1, "gold"],
  ])
    b.box(m, x, 0.02, z, 0.36, 0.1, 0.36);
  return b;
}

/** A tall clay urn (amphora-like, no handles). */
function urn() {
  const b = new Builder();
  b.prism("terracottaDark", 0, 0, 0, 0.12, 0.16, 0.06, 10);
  b.prism("terracotta", 0, 0.06, 0, 0.16, 0.25, 0.25, 10);
  b.prism("terracotta", 0, 0.31, 0, 0.25, 0.2, 0.2, 10);
  b.prism("terracotta", 0, 0.51, 0, 0.2, 0.1, 0.12, 10);
  b.prism("gold", 0, 0.29, 0, 0.255, 0.255, 0.04, 10, 0, false);
  b.prism("terracottaDark", 0, 0.63, 0, 0.1, 0.13, 0.06, 10);
  return b;
}

/** A gold mannequin stand (boutique window display outside the palace). */
function mannequin() {
  const b = new Builder();
  b.prism("onyx", 0, 0, 0, 0.18, 0.18, 0.05, 10);
  b.prism("gold", 0, 0.05, 0, 0.025, 0.025, 0.55, 6);
  b.prism("onyxSoft", 0, 0.6, 0, 0.12, 0.17, 0.45, 8);
  b.prism("onyxSoft", 0, 1.05, 0, 0.17, 0.13, 0.15, 8);
  b.prism("gold", 0, 1.2, 0, 0.04, 0.04, 0.06, 6);
  b.sphere("gold", 0, 1.33, 0, 0.09, 8, 4);
  return b;
}

// ---------------------------------------------------------------- output

const MODELS = {
  "b-town-hall": {
    build: townHall,
    kind: "building",
    tags: ["civicmind", "town-hall", "clock-tower", "civic"],
    footprintUnit: "hex",
  },
  "b-crystal-lamp": {
    build: crystalLamp,
    kind: "prop",
    tags: ["lamp", "crystal", "glow", "civicmind"],
  },
  "b-crystal-cluster": {
    build: crystalCluster,
    kind: "prop",
    tags: ["crystal", "glow", "civicmind"],
  },
  "b-planter": {
    build: planter,
    kind: "prop",
    tags: ["planter", "garden", "civicmind"],
  },
  "b-bench": {
    build: bench,
    kind: "prop",
    tags: ["bench", "seat", "civicmind"],
  },
  "b-notice-column": {
    build: noticeColumn,
    kind: "prop",
    tags: ["column", "notice", "civicmind"],
  },
  "b-palace": {
    build: palace,
    kind: "building",
    tags: ["onyx", "palace", "boutique", "dome"],
    footprintUnit: "hex",
  },
  "b-hex-sand": {
    build: sandHex,
    kind: "terrain",
    tags: ["sand", "desert", "walkable", "onyx"],
    terrain: true,
  },
  "b-hex-paving": {
    build: () => pavedHex("stoneDark", "stoneLight", "stone", "stoneLight"),
    kind: "terrain",
    tags: ["stone", "paving", "walkable", "civicmind"],
    terrain: true,
  },
  "b-hex-mosaic": {
    build: () => pavedHex("sandSide", "sandDark", "rugCream", "gold", 0.55),
    kind: "terrain",
    tags: ["stone", "mosaic", "walkable", "onyx"],
    terrain: true,
  },
  "b-rug-red": {
    build: () => rug("rugRed", "rugCream", "gold"),
    kind: "prop",
    tags: ["rug", "carpet", "onyx"],
    flat: true,
  },
  "b-rug-teal": {
    build: () => rug("rugTeal", "rugCream", "rugRed"),
    kind: "prop",
    tags: ["rug", "carpet", "onyx"],
    flat: true,
  },
  "b-rug-indigo": {
    build: () => rug("rugIndigo", "gold", "rugCream"),
    kind: "prop",
    tags: ["rug", "carpet", "onyx"],
    flat: true,
  },
  "b-lantern-gold": {
    build: goldLantern,
    kind: "prop",
    tags: ["lantern", "lamp", "glow", "onyx"],
  },
  "b-bazaar-stall": {
    build: bazaarStall,
    kind: "prop",
    tags: ["stall", "awning", "bazaar", "onyx"],
  },
  "b-pavilion": {
    build: pavilion,
    kind: "prop",
    tags: ["canopy", "awning", "bazaar", "onyx"],
  },
  "b-urn": { build: urn, kind: "prop", tags: ["pot", "clay", "onyx"] },
  "b-mannequin": {
    build: mannequin,
    kind: "prop",
    tags: ["mannequin", "boutique", "onyx"],
  },
};

async function writeModel(name, spec) {
  const b = spec.build();
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh(name);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triCount = 0;
  for (const [matName, pos] of b.tris) {
    const def = PALETTE[matName];
    const mat = doc
      .createMaterial(matName)
      .setBaseColorFactor([...lin(def.color), 1])
      .setRoughnessFactor(def.rough ?? 0.9)
      .setMetallicFactor(def.metal ?? 0);
    if (def.emissive) {
      const e = lin(def.emissive).map((v) =>
        Math.min(1, v * (def.strength ?? 1))
      );
      mat.setEmissiveFactor(e);
    }
    const positions = new Float32Array(pos);
    const normals = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 9) {
      const a = [pos[i], pos[i + 1], pos[i + 2]];
      const bb = [pos[i + 3], pos[i + 4], pos[i + 5]];
      const c = [pos[i + 6], pos[i + 7], pos[i + 8]];
      const n = cross(sub(bb, a), sub(c, a));
      const l = Math.hypot(...n) || 1;
      for (let k = 0; k < 3; k++) {
        normals[i + k * 3] = n[0] / l;
        normals[i + k * 3 + 1] = n[1] / l;
        normals[i + k * 3 + 2] = n[2] / l;
      }
    }
    for (let i = 0; i < pos.length; i += 3)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], pos[i + k]);
        max[k] = Math.max(max[k], pos[i + k]);
      }
    triCount += pos.length / 9;
    const prim = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(positions)
          .setBuffer(buffer)
      )
      .setAttribute(
        "NORMAL",
        doc.createAccessor().setType("VEC3").setArray(normals).setBuffer(buffer)
      )
      .setMaterial(mat);
    mesh.addPrimitive(prim);
  }
  const node = doc.createNode(name).setMesh(mesh);
  doc.createScene(name).addChild(node);
  const file = `${name}.glb`;
  const bytes = await new NodeIO().writeBinary(doc);
  fs.writeFileSync(path.join(OUT, file), bytes);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const size = [r3(max[0] - min[0]), r3(max[1] - min[1]), r3(max[2] - min[2])];
  const entry = {
    file,
    source: "procedural",
    license: "CC0",
    kind: spec.kind,
    footprint:
      spec.footprintUnit === "hex" || spec.terrain
        ? [1, 1]
        : [r3(size[0]), r3(size[2])],
    footprintUnit: spec.footprintUnit === "hex" || spec.terrain ? "hex" : "m",
    height: size[1],
    scale: 1,
    size,
    minY: r3(min[1]),
    tags: spec.tags,
    solid: !(spec.flat || spec.terrain),
    lazy: true,
    bytes: bytes.byteLength,
    banned: false,
    reason: "",
  };
  if (spec.terrain) entry.walkable = true;
  if (spec.flat) entry.overlay = true;
  console.log(
    `${name}: ${triCount} tris, ${bytes.byteLength} B, size ${size.join(" x ")}`
  );
  return entry;
}

const fragment = { models: {} };
for (const [name, spec] of Object.entries(MODELS)) {
  fragment.models[name] = await writeModel(name, spec);
}
fs.writeFileSync(FRAGMENT, JSON.stringify(fragment, null, 2) + "\n");
console.log(
  `wrote ${Object.keys(fragment.models).length} models to ${path.relative(process.cwd(), FRAGMENT)}`
);
