#!/usr/bin/env node
/**
 * Island designer group "a" (home + khidmty): small flat-shaded low-poly props that the CC0 kits
 * lack, written as glbs into public/game3d/models/a-<name>.glb and registered in
 * public/game3d/models/custom-a.json. Run: node scripts/3d/procedural/a.mjs
 *
 * Every shape is made from boxes, cylinders, cones and prisms with per-material colours close to the
 * KayKit palette. No cross shapes: boards hang between two posts under a roof, wheels are solid discs.
 */

import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";

const OUT = path.join(process.cwd(), "public", "game3d", "models");
const FRAGMENT = path.join(OUT, "custom-a.json");

/** KayKit-ish palette (sRGB hex). */
const C = {
  wood: "#a8693f",
  woodDark: "#6e4127",
  woodLight: "#c98f5a",
  stone: "#a3a7ad",
  stoneDark: "#7c8189",
  roofRed: "#d8473c",
  roofGreen: "#5aa54b",
  roofBlue: "#3f7fcf",
  cream: "#f3e6c8",
  paper: "#fbf6ea",
  paperBlue: "#cfe4f7",
  paperPink: "#f6d2cf",
  gold: "#e8b84a",
  copper: "#c7743a",
  pipe: "#b9c0c7",
  red: "#cf3e36",
  blue: "#3c78c8",
  yellow: "#efc23d",
  green: "#56a64a",
  white: "#f4f4f0",
  black: "#3b3631",
};

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    srgbToLinear(v / 255)
  );
}

/* ---------------------------------------------------------------- geometry */

/** A mesh builder: triangles grouped by colour, flat normals. */
class Builder {
  constructor() {
    this.groups = new Map();
  }
  tri(color, a, b, c) {
    let g = this.groups.get(color);
    if (!g) {
      g = [];
      this.groups.set(color, g);
    }
    g.push(a, b, c);
  }
  quad(color, a, b, c, d) {
    this.tri(color, a, b, c);
    this.tri(color, a, c, d);
  }
  bounds() {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const tris of this.groups.values())
      for (const p of tris)
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], p[i]);
          max[i] = Math.max(max[i], p[i]);
        }
    return { min, max };
  }
}

/** Transform helper: rotate around y by `ry` (radians), then around x by `rx`, then translate. */
function xf(p, t = {}) {
  let [x, y, z] = p;
  if (t.rz) {
    const c = Math.cos(t.rz);
    const s = Math.sin(t.rz);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  if (t.rx) {
    const c = Math.cos(t.rx);
    const s = Math.sin(t.rx);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (t.ry) {
    const c = Math.cos(t.ry);
    const s = Math.sin(t.ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  const o = t.at ?? [0, 0, 0];
  return [x + o[0], y + o[1], z + o[2]];
}

/** Axis-aligned box from its size, centred on x/z, bottom at y = 0 (before the transform). */
function box(b, color, [w, h, d], t = {}) {
  const x = w / 2;
  const z = d / 2;
  const v = [
    [-x, 0, -z],
    [x, 0, -z],
    [x, 0, z],
    [-x, 0, z],
    [-x, h, -z],
    [x, h, -z],
    [x, h, z],
    [-x, h, z],
  ].map((p) => xf(p, t));
  const f = (i, j, k, l) => b.quad(color, v[i], v[j], v[k], v[l]);
  f(4, 7, 6, 5); // top
  f(0, 1, 2, 3); // bottom
  f(3, 2, 6, 7); // +z
  f(1, 0, 4, 5); // -z
  f(2, 1, 5, 6); // +x
  f(0, 3, 7, 4); // -x
}

/** Frustum / cylinder / cone along +y with `n` sides, bottom at y = 0. */
function cyl(b, color, rBottom, rTop, h, n, t = {}, capColor = color) {
  const ring = (r, y) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return xf([Math.cos(a) * r, y, Math.sin(a) * r], t);
    });
  const lo = ring(rBottom, 0);
  const hi = ring(rTop, h);
  const cTop = xf([0, h, 0], t);
  const cBot = xf([0, 0, 0], t);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (rTop > 1e-6) b.quad(color, lo[i], hi[i], hi[j], lo[j]);
    else b.tri(color, lo[i], cTop, lo[j]);
    if (rTop > 1e-6) b.tri(capColor, hi[j], hi[i], cTop);
    b.tri(capColor, lo[i], lo[j], cBot);
  }
}

/** A triangular prism roof along x: width w (x), depth d (z), ridge height h, bottom at y = 0. */
function gable(b, color, [w, h, d], t = {}, endColor = color) {
  const x = w / 2;
  const z = d / 2;
  const v = [
    [-x, 0, -z],
    [x, 0, -z],
    [x, 0, z],
    [-x, 0, z],
    [-x, h, 0],
    [x, h, 0],
  ].map((p) => xf(p, t));
  b.quad(color, v[3], v[2], v[5], v[4]); // +z slope
  b.quad(color, v[1], v[0], v[4], v[5]); // -z slope
  b.tri(endColor, v[0], v[3], v[4]); // -x end
  b.tri(endColor, v[2], v[1], v[5]); // +x end
  b.quad(color, v[0], v[1], v[2], v[3]); // underside
}

/* ---------------------------------------------------------------- writing */

async function writeGlb(name, b) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh(name);
  for (const [color, tris] of b.groups) {
    const pos = new Float32Array(tris.length * 3);
    const nor = new Float32Array(tris.length * 3);
    for (let i = 0; i < tris.length; i += 3) {
      const [a, bb, c] = [tris[i], tris[i + 1], tris[i + 2]];
      const u = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]];
      const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [
        u[1] * w[2] - u[2] * w[1],
        u[2] * w[0] - u[0] * w[2],
        u[0] * w[1] - u[1] * w[0],
      ];
      const len = Math.hypot(...n) || 1;
      n = n.map((v) => v / len);
      for (let k = 0; k < 3; k++) {
        pos.set(tris[i + k], (i + k) * 3);
        nor.set(n, (i + k) * 3);
      }
    }
    const material = doc
      .createMaterial(`${name}-${color.slice(1)}`)
      .setBaseColorFactor([...hexColor(color), 1])
      .setRoughnessFactor(0.9)
      .setMetallicFactor(0);
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
      .setMaterial(material);
    mesh.addPrimitive(prim);
  }
  const node = doc.createNode(name).setMesh(mesh);
  doc.createScene(name).addChild(node);
  const file = `${name}.glb`;
  await new NodeIO().write(path.join(OUT, file), doc);
  const { min, max } = b.bounds();
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return {
    file,
    size: [r3(max[0] - min[0]), r3(max[1] - min[1]), r3(max[2] - min[2])],
    minY: r3(min[1]),
    bytes: fs.statSync(path.join(OUT, file)).size,
  };
}

/* ---------------------------------------------------------------- models */

const MODELS = {};

/** Notice board: a framed board hung between two posts under a little roof (no post sticks up). */
MODELS["a-notice-board"] = {
  kind: "prop",
  footprint: [1.3, 0.4],
  tags: ["board", "notice-board", "news", "home", "plaza"],
  build(b) {
    const postH = 1.32;
    for (const x of [-0.58, 0.58])
      box(b, C.woodDark, [0.1, postH, 0.1], { at: [x, 0, 0] });
    box(b, C.wood, [1.08, 0.66, 0.06], { at: [0, 0.55, 0] }); // board
    box(b, C.woodDark, [1.12, 0.05, 0.1], { at: [0, 0.52, 0] }); // bottom rail
    box(b, C.woodDark, [1.12, 0.05, 0.1], { at: [0, 1.2, 0] }); // top rail
    // pinned notes on the front (+z)
    const notes = [
      [-0.32, 0.66, 0.26, 0.3, C.paper],
      [0.02, 0.74, 0.24, 0.32, C.paperBlue],
      [0.33, 0.64, 0.22, 0.26, C.paperPink],
      [-0.1, 0.96, 0.3, 0.18, C.paper],
      [0.3, 0.95, 0.2, 0.18, C.paper],
    ];
    for (const [x, y, w, h, col] of notes) {
      box(b, col, [w, h, 0.012], { at: [x, y, 0.035] });
      box(b, C.red, [0.03, 0.03, 0.012], { at: [x, y + h - 0.05, 0.045] });
    }
    gable(b, C.roofRed, [1.4, 0.26, 0.42], { at: [0, postH, 0] }, C.woodDark);
    box(b, C.woodLight, [0.9, 0.06, 0.22], { at: [0, 0.18, 0.06] }); // little shelf at the foot
  },
};

/** Garden pavilion: hexagonal stone floor, six slim columns, a two-tier hex roof. */
MODELS["a-pavilion"] = {
  kind: "building",
  footprint: [1, 1],
  footprintUnit: "hex",
  tags: ["pavilion", "gazebo", "garden", "hobbies", "home"],
  build(b) {
    cyl(b, C.stoneDark, 1.3, 1.25, 0.12, 6, { ry: Math.PI / 6 });
    cyl(b, C.stone, 1.18, 1.14, 0.08, 6, { ry: Math.PI / 6, at: [0, 0.12, 0] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const at = [Math.cos(a) * 1.0, 0.2, Math.sin(a) * 1.0];
      cyl(b, C.cream, 0.075, 0.065, 1.35, 6, { at });
      cyl(b, C.stone, 0.11, 0.11, 0.08, 6, { at });
    }
    cyl(b, C.woodDark, 1.2, 1.2, 0.1, 6, { ry: Math.PI / 6, at: [0, 1.55, 0] });
    cyl(b, C.roofGreen, 1.5, 0.55, 0.45, 6, {
      ry: Math.PI / 6,
      at: [0, 1.65, 0],
    });
    cyl(b, C.roofGreen, 0.62, 0.0, 0.55, 6, {
      ry: Math.PI / 6,
      at: [0, 2.1, 0],
    });
    cyl(b, C.gold, 0.06, 0.0, 0.22, 6, { at: [0, 2.62, 0] });
    // a low round table inside
    cyl(b, C.woodDark, 0.06, 0.06, 0.42, 6, { at: [0, 0.2, 0] });
    cyl(b, C.wood, 0.34, 0.34, 0.05, 8, { at: [0, 0.62, 0] });
  },
};

/** A hand cart with solid disc wheels (no spokes) and two shafts. */
MODELS["a-cart"] = {
  kind: "prop",
  footprint: [1.0, 1.5],
  tags: ["cart", "market", "khidmty"],
  build(b) {
    box(b, C.wood, [0.8, 0.08, 1.0], { at: [0, 0.38, 0] });
    box(b, C.woodLight, [0.08, 0.28, 1.0], { at: [-0.4, 0.46, 0] });
    box(b, C.woodLight, [0.08, 0.28, 1.0], { at: [0.4, 0.46, 0] });
    box(b, C.woodLight, [0.8, 0.28, 0.08], { at: [0, 0.46, -0.5] });
    box(b, C.woodLight, [0.8, 0.22, 0.08], { at: [0, 0.46, 0.5] });
    for (const x of [-0.47, 0.47]) {
      // disc wheel: a cylinder on its side, with a hub
      cyl(b, C.woodDark, 0.3, 0.3, 0.07, 10, {
        rz: Math.PI / 2,
        at: [x + 0.035, 0.3, 0.05],
      });
      cyl(b, C.stoneDark, 0.08, 0.08, 0.1, 6, {
        rz: Math.PI / 2,
        at: [x + 0.05 * Math.sign(x) + 0.05, 0.3, 0.05],
      });
    }
    for (const x of [-0.3, 0.3])
      box(b, C.woodDark, [0.06, 0.06, 0.6], { at: [x, 0.36, 0.78] });
    // goods: a sack and a crate
    box(b, C.woodLight, [0.32, 0.3, 0.32], { at: [-0.16, 0.46, -0.2] });
    cyl(b, C.cream, 0.17, 0.12, 0.3, 7, { at: [0.18, 0.46, 0.18] });
  },
};

/** Painters: three paint pots with coloured tops and drips. */
MODELS["a-paint-pots"] = {
  kind: "prop",
  footprint: [0.6, 0.5],
  tags: ["paint", "painter", "bucket", "khidmty"],
  build(b) {
    const pots = [
      [-0.16, 0.0, C.blue, 0.13, 0.26],
      [0.15, -0.06, C.red, 0.12, 0.22],
      [0.04, 0.17, C.yellow, 0.11, 0.2],
    ];
    for (const [x, z, col, r, h] of pots) {
      cyl(b, C.white, r, r * 1.05, h, 10, { at: [x, 0, z] });
      cyl(b, col, r * 0.98, r * 0.98, 0.015, 10, { at: [x, h, z] });
      box(b, col, [0.04, h * 0.45, 0.02], {
        at: [x + r * 0.6, h * 0.55, z + r * 0.8],
      });
    }
    // a paint roller leaning flat on the ground
    cyl(b, C.green, 0.045, 0.045, 0.2, 8, {
      rz: Math.PI / 2,
      at: [0.12, 0.045, 0.3],
    });
    box(b, C.woodDark, [0.02, 0.02, 0.22], { at: [0.02, 0.035, 0.42] });
  },
};

/** Plumbers: a small stack of pipes with copper elbows. */
MODELS["a-pipe-stack"] = {
  kind: "prop",
  footprint: [0.9, 0.5],
  tags: ["pipes", "plumber", "khidmty"],
  build(b) {
    const r = 0.07;
    const rows = [
      [-0.15, 0],
      [0, 0],
      [0.15, 0],
      [-0.075, 1],
      [0.075, 1],
      [0, 2],
    ];
    for (const [z, row] of rows) {
      cyl(
        b,
        C.pipe,
        r,
        r,
        0.85,
        8,
        { rz: Math.PI / 2, at: [0.425, r + row * r * 1.75, z] },
        C.stoneDark
      );
    }
    box(b, C.woodDark, [0.08, 0.06, 0.5], { at: [-0.3, 0, 0] });
    box(b, C.woodDark, [0.08, 0.06, 0.5], { at: [0.3, 0, 0] });
    cyl(b, C.copper, 0.08, 0.08, 0.12, 8, { at: [0.0, 0, 0.32] });
    cyl(b, C.copper, 0.08, 0.08, 0.12, 8, { at: [0.2, 0, 0.34] });
  },
};

/** Electricians: a wooden cable drum with copper wire wound on it. */
MODELS["a-cable-spool"] = {
  kind: "prop",
  footprint: [0.7, 0.6],
  tags: ["cable", "spool", "electrician", "khidmty"],
  build(b) {
    const ax = { rz: Math.PI / 2 };
    cyl(b, C.woodLight, 0.32, 0.32, 0.06, 10, { ...ax, at: [0.22, 0.32, 0] });
    cyl(b, C.woodLight, 0.32, 0.32, 0.06, 10, { ...ax, at: [-0.16, 0.32, 0] });
    cyl(b, C.copper, 0.22, 0.22, 0.32, 10, { ...ax, at: [0.16, 0.32, 0] });
    cyl(b, C.woodDark, 0.06, 0.06, 0.5, 6, { ...ax, at: [0.25, 0.32, 0] });
    // loose wire end on the ground
    box(b, C.copper, [0.03, 0.03, 0.4], { at: [0.05, 0, 0.35], ry: 0.4 });
  },
};

/** Carpenters / guild: a sawhorse-free plank workbench with a vice and planks (no X legs). */
MODELS["a-plank-bench"] = {
  kind: "prop",
  footprint: [1.3, 0.6],
  tags: ["workbench", "carpenter", "tools", "khidmty"],
  build(b) {
    box(b, C.wood, [1.3, 0.08, 0.55], { at: [0, 0.62, 0] });
    for (const x of [-0.55, 0.55]) {
      box(b, C.woodDark, [0.08, 0.62, 0.45], { at: [x, 0, 0] }); // solid end panels
    }
    box(b, C.woodDark, [1.1, 0.06, 0.4], { at: [0, 0.18, 0] }); // shelf
    box(b, C.stoneDark, [0.16, 0.14, 0.16], { at: [0.5, 0.7, 0.18] }); // vice
    box(b, C.woodLight, [0.9, 0.04, 0.16], { at: [-0.1, 0.7, -0.08] }); // plank on top
    box(b, C.woodLight, [0.7, 0.04, 0.12], { at: [-0.2, 0.74, 0.1] });
    // toolbox on the shelf
    box(b, C.red, [0.34, 0.14, 0.18], { at: [-0.25, 0.24, 0] });
    box(b, C.stoneDark, [0.2, 0.03, 0.03], { at: [-0.25, 0.4, 0] });
    box(b, C.stoneDark, [0.03, 0.03, 0.03], { at: [-0.34, 0.38, 0] });
    box(b, C.stoneDark, [0.03, 0.03, 0.03], { at: [-0.16, 0.38, 0] });
  },
};

/** Garden bed: a low wooden frame filled with soil and rows of little flowers. */
MODELS["a-flower-bed"] = {
  kind: "nature",
  footprint: [1.2, 0.7],
  solid: false,
  tags: ["garden", "flower", "bed", "home"],
  build(b) {
    box(b, C.woodDark, [1.2, 0.14, 0.7]);
    box(b, "#6b4a2f", [1.1, 0.03, 0.6], { at: [0, 0.14, 0] });
    const cols = [C.red, C.yellow, C.white, "#b56ad8", C.red, C.yellow];
    let k = 0;
    for (const z of [-0.17, 0.0, 0.17])
      for (const x of [-0.42, -0.21, 0, 0.21, 0.42]) {
        const col = cols[k++ % cols.length];
        cyl(b, C.green, 0.02, 0.02, 0.1, 4, { at: [x, 0.16, z] });
        cyl(b, col, 0.055, 0.0, 0.08, 5, { at: [x, 0.25, z], rx: Math.PI });
        cyl(b, col, 0.055, 0.03, 0.03, 5, { at: [x, 0.24, z] });
      }
  },
};

/** Plaza paving: a full-size hex of cobbles (flat overlay, neighbours join into one plaza). */
MODELS["a-plaza-stone"] = {
  kind: "terrain",
  overlay: true,
  footprint: [1, 1],
  footprintUnit: "hex",
  solid: false,
  walkable: true,
  tags: ["plaza", "path", "paving", "overlay", "home"],
  build(b) {
    const R = 2 / Math.sqrt(3);
    // base slab, slightly larger than the hex so neighbouring slabs meet without seams
    cyl(b, "#c9b89c", R * 1.02, R * 1.02, 0.03, 6, { ry: Math.PI / 6 });
    // cobbles: a jittered grid of small low boxes clipped to the hex
    const tints = ["#d8c9ad", "#bfae91", "#cdbfa6", "#b3a184", "#e0d3b9"];
    let k = 0;
    const step = 0.36;
    for (let row = -4; row <= 4; row++) {
      for (let col = -4; col <= 4; col++) {
        const x = col * step + (row % 2 ? step / 2 : 0);
        const z = row * step * 0.92;
        // inside the pointy-top hex (apothem 1 across x)?
        const ax = Math.abs(x);
        const az = Math.abs(z);
        if (
          ax > 0.86 ||
          az > R * 0.86 ||
          ax * 0.5 + az * (Math.sqrt(3) / 2) > 0.86
        )
          continue;
        const j = ((row * 7 + col * 13 + 40) % 9) / 9;
        box(
          b,
          tints[k++ % tints.length],
          [0.3 - j * 0.05, 0.03, 0.28 - j * 0.04],
          {
            at: [x + (j - 0.5) * 0.04, 0.03, z],
            ry: (j - 0.5) * 0.4,
          }
        );
      }
    }
  },
};

/** Plaza statue: a stepped plinth and a stone figure holding a book (arms down, no cross shapes). */
MODELS["a-statue"] = {
  kind: "prop",
  footprint: [1.0, 1.0],
  tags: ["statue", "monument", "plaza"],
  build(b) {
    const st = "#b9bcc2";
    const st2 = "#9da1a8";
    box(b, st2, [1.0, 0.18, 1.0]);
    box(b, st, [0.78, 0.5, 0.78], { at: [0, 0.18, 0] });
    box(b, st2, [0.86, 0.06, 0.86], { at: [0, 0.68, 0] });
    // figure (about 1.2 m): robe, torso, head, arms at the sides
    cyl(b, st, 0.26, 0.2, 0.62, 8, { at: [0, 0.74, 0] });
    cyl(b, st, 0.2, 0.17, 0.36, 8, { at: [0, 1.36, 0] });
    cyl(b, st, 0.11, 0.1, 0.2, 8, { at: [0, 1.72, 0] });
    cyl(b, st2, 0.13, 0.0, 0.1, 8, { at: [0, 1.88, 0] });
    for (const x of [-0.22, 0.22])
      cyl(b, st, 0.055, 0.05, 0.42, 6, { at: [x, 1.12, 0] });
    // an open book held in front
    box(b, st2, [0.26, 0.04, 0.18], { at: [0, 1.22, 0.2], rx: -0.5 });
    // a small bronze plaque
    box(b, "#b8893e", [0.34, 0.16, 0.02], { at: [0, 0.34, 0.39] });
  },
};

/** A clipped box hedge, long along z (lies on a hex edge like the KayKit edge fences). */
MODELS["a-hedge"] = {
  kind: "nature",
  footprint: [0.36, 1.1],
  tags: ["hedge", "garden"],
  build(b) {
    box(b, "#4f9a45", [0.36, 0.46, 1.1]);
    box(b, "#63b04f", [0.3, 0.06, 1.04], { at: [0, 0.46, 0] });
    // a few leafy bumps on the sides
    for (const z of [-0.35, 0.05, 0.4])
      for (const x of [-0.17, 0.17])
        box(b, "#58a64a", [0.06, 0.2, 0.22], {
          at: [x + Math.sign(x) * 0.02, 0.12, z],
        });
  },
};

/* ---------------------------------------------------------------- main */

const fragment = { models: {} };
for (const [name, spec] of Object.entries(MODELS)) {
  const b = new Builder();
  spec.build(b);
  const info = await writeGlb(name, b);
  const fp = spec.footprint;
  fragment.models[name] = {
    file: info.file,
    source: "procedural",
    license: "CC0",
    kind: spec.kind,
    footprint: fp,
    footprintUnit: spec.footprintUnit ?? "m",
    ...(spec.overlay ? { overlay: true } : {}),
    ...(spec.walkable !== undefined ? { walkable: spec.walkable } : {}),
    height: info.size[1],
    scale: 1,
    size: info.size,
    minY: info.minY,
    tags: spec.tags,
    ...(spec.solid !== undefined ? { solid: spec.solid } : { solid: true }),
    // khidmty-only props are not needed for the first (home) view
    lazy: spec.tags.includes("khidmty") && !spec.tags.includes("home"),
    bytes: info.bytes,
    banned: false,
    reason: "",
  };
  console.log(name, info.size, info.bytes, "bytes");
}
fs.writeFileSync(FRAGMENT, JSON.stringify(fragment, null, 2) + "\n");
console.log("wrote", path.relative(process.cwd(), FRAGMENT));
