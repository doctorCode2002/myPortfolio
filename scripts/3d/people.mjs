#!/usr/bin/env node
/**
 * Mayor characters for the real island owners (Wejdan for WACO, Bahaa for Khidmty, Saleh and Eyad):
 * stylized low-poly KayKit-style figures that are recognisable rather than photo-real.
 *
 * Each one is kit-bashed from the KayKit Adventurers 1.0 rigs (CC0, all five share one skeleton and bind
 * pose): a base body, a head (and optionally the hair or beard triangles of another adventurer's head),
 * new colours, and a few procedural pieces (a hijab drape, a long skirt, a tie and pocket square,
 * hoodie drawstrings, sunglasses, a smile) weighted to the same bones, so every KayKit clip (Idle,
 * Walking_A, Running_A, Interact, Cheer, ...) keeps working. Weapons, hats, helmets, capes and the
 * rogue's ear cuff are removed. Everything is merged into one skinned mesh with one small palette
 * texture (one draw call), then optimised like scripts/3d/curate.mjs does (resampled, quantized,
 * rest channels dropped).
 *
 * Outputs public/game3d/models/character-<id>.glb and the manifest fragment custom-people.json.
 * They are mayors only (tag "mayor", no "player" tag), so the character picker never offers them.
 *
 *   node scripts/3d/people.mjs [kaykitCharactersDir]
 *
 * No photos are read or stored by this script: the colours and shapes below were chosen by eye.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  quantize,
  resample,
  weld,
} from "@gltf-transform/functions";
import sharp from "sharp";

const DEFAULT_SOURCE =
  "/tmp/claude-1000/-home-mohammed/b1ba6010-9ea1-4ed2-8f3b-791ac93a4c0c/scratchpad/dl-3d/kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf";
const OUT_DIR = path.resolve(import.meta.dirname, "../../public/game3d/models");
const FRAGMENT = path.join(OUT_DIR, "custom-people.json");
const CHARACTER_HEIGHT = 0.9;

/** The clips kept on every KayKit adventurer (same list as scripts/3d/curate.mjs). */
const KAYKIT_CLIPS = [
  "Idle",
  "Unarmed_Idle",
  "Walking_A",
  "Walking_B",
  "Walking_C",
  "Walking_Backwards",
  "Running_A",
  "Running_B",
  "Jump_Start",
  "Jump_Idle",
  "Jump_Land",
  "Jump_Full_Short",
  "Cheer",
  "Interact",
  "PickUp",
  "Use_Item",
  "Spellcast_Raise",
  "Hit_A",
  "Sit_Chair_Down",
  "Sit_Chair_Idle",
  "Sit_Chair_StandUp",
  "Sit_Floor_Down",
  "Sit_Floor_Idle",
  "Sit_Floor_StandUp",
];

/** Every non-body node on the KayKit rigs: weapons, books, mug, hats, helmets and capes. */
const DROP_NODES =
  /^(1H_|2H_|Knife|Throwable|Mug$|Spellbook|.*Shield|.*_Hat$|.*_Helmet$|.*_Cape$)/;

// Joint indices of the shared KayKit skeleton.
const J = {
  hips: 1,
  spine: 2,
  chest: 3,
  head: 14,
  upperlegL: 15,
  lowerlegL: 16,
  upperlegR: 19,
  lowerlegR: 20,
};

// ---------------------------------------------------------------- colours
function hexRgb(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------------------------------------------------------- source geometry
/**
 * A triangle soup: per corner position, normal, joints, weights, and per triangle a colour and the
 * corner's place inside its colour swatch (u, v in 0..1, kept from the source so the gradients stay).
 */
class Soup {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.jnt = [];
    this.wgt = [];
    this.uvf = [];
    this.col = [];
  }
  corner(p, n, j, w, uvf) {
    this.pos.push(...p);
    this.nrm.push(...n);
    this.jnt.push(...j);
    this.wgt.push(...w);
    this.uvf.push(...uvf);
  }
  get count() {
    return this.pos.length / 3;
  }
}

/** Triangles of a skinned mesh node, with the source swatch cell (col,row of the 8x4 KayKit atlas). */
function readTriangles(node) {
  const out = [];
  for (const prim of node.getMesh().listPrimitives()) {
    const P = prim.getAttribute("POSITION");
    const N = prim.getAttribute("NORMAL");
    const U = prim.getAttribute("TEXCOORD_0");
    const JN = prim.getAttribute("JOINTS_0");
    const W = prim.getAttribute("WEIGHTS_0");
    const I = prim.getIndices();
    const n = I ? I.getCount() : P.getCount();
    const v = (i) => {
      const p = P.getElement(i, []);
      const nn = N.getElement(i, []);
      const uv = U.getElement(i, []);
      const j = JN ? JN.getElement(i, []) : [J.head, 0, 0, 0];
      const w = W ? W.getElement(i, []) : [1, 0, 0, 0];
      return { p, n: nn, uv, j, w };
    };
    for (let t = 0; t < n; t += 3) {
      const ids = I
        ? [I.getScalar(t), I.getScalar(t + 1), I.getScalar(t + 2)]
        : [t, t + 1, t + 2];
      const c = ids.map(v);
      const mu = (c[0].uv[0] + c[1].uv[0] + c[2].uv[0]) / 3;
      const mv = (c[0].uv[1] + c[1].uv[1] + c[2].uv[1]) / 3;
      const cell = `${Math.floor(mu * 8)},${Math.floor(mv * 4)}`;
      const cx = Math.floor(mu * 8);
      const cy = Math.floor(mv * 4);
      for (const k of c)
        k.uvf = [clamp01(k.uv[0] * 8 - cx), clamp01(k.uv[1] * 4 - cy)];
      const centroid = [0, 1, 2].map(
        (a) => (c[0].p[a] + c[1].p[a] + c[2].p[a]) / 3
      );
      out.push({ corners: c, cell, centroid });
    }
  }
  return out;
}

function clamp01(x) {
  return Math.min(0.96, Math.max(0.04, x));
}

// ---------------------------------------------------------------- procedural shapes
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const nrmz = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * A procedural part: quads/triangles in bind space, a colour, and a weighting rule
 * (a fixed joint, or a function of the corner position).
 */
class Part {
  constructor(color, weight) {
    this.color = color;
    this.weight = weight;
    this.tris = [];
  }
  tri(a, b, c) {
    this.tris.push([a, b, c]);
    return this;
  }
  quad(a, b, c, d) {
    return this.tri(a, b, c).tri(a, c, d);
  }
}

/** Ring of points (y, radii, centre) used for frustums. */
function ring(cx, cz, y, rx, rz, seg, a0 = 0, a1 = Math.PI * 2) {
  const pts = [];
  const closed = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  const n = closed ? seg : seg + 1;
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    pts.push([cx + Math.sin(a) * rx, y, cz + Math.cos(a) * rz]);
  }
  return { pts, closed };
}

/** Side wall between two rings (outward facing), optionally capping the bottom. */
function band(part, lo, hi) {
  const n = lo.pts.length;
  const m = lo.closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const k = (i + 1) % n;
    part.quad(lo.pts[i], lo.pts[k], hi.pts[k], hi.pts[i]);
  }
  return part;
}

/** An axis-aligned box (optionally sheared/tapered by a corner map). */
function box(part, c, s, map = (p) => p) {
  const [x, y, z] = c;
  const [hx, hy, hz] = [s[0] / 2, s[1] / 2, s[2] / 2];
  const P = (dx, dy, dz) =>
    map([x + dx * hx, y + dy * hy, z + dz * hz], [dx, dy, dz]);
  const v = [
    P(-1, -1, -1),
    P(1, -1, -1),
    P(1, 1, -1),
    P(-1, 1, -1),
    P(-1, -1, 1),
    P(1, -1, 1),
    P(1, 1, 1),
    P(-1, 1, 1),
  ];
  const f = [
    [4, 5, 6, 7],
    [1, 0, 3, 2],
    [5, 1, 2, 6],
    [0, 4, 7, 3],
    [7, 6, 2, 3],
    [0, 1, 5, 4],
  ];
  for (const q of f) part.quad(v[q[0]], v[q[1]], v[q[2]], v[q[3]]);
  return part;
}

/** A flat disc facing +z (n-gon) with a rim depth. */
function lens(part, c, r, depth, seg = 10, tiltY = 0) {
  const rot = (p) => {
    const dx = p[0] - c[0];
    const dz = p[2] - c[2];
    const a = tiltY;
    return [
      c[0] + dx * Math.cos(a) + dz * Math.sin(a),
      p[1],
      c[2] - dx * Math.sin(a) + dz * Math.cos(a),
    ];
  };
  const front = [];
  const back = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    front.push(
      rot([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + depth / 2])
    );
    back.push(
      rot([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] - depth / 2])
    );
  }
  const fc = rot([c[0], c[1], c[2] + depth / 2]);
  const bc = rot([c[0], c[1], c[2] - depth / 2]);
  for (let i = 0; i < seg; i++) {
    const k = (i + 1) % seg;
    part.tri(fc, front[i], front[k]);
    part.tri(bc, back[k], back[i]);
    part.quad(front[k], front[i], back[i], back[k]);
  }
  return part;
}

// ---------------------------------------------------------------- character specs
/**
 * Each spec: base file (body, arms, legs), head source(s), a colour function per source triangle
 * (return null to drop it), an optional vertex edit, and procedural parts.
 */

const NAVY = "#1f2a44";
const NAVY_DARK = "#172036";
const HIJAB = "#f3f1ec";
const HIJAB_SHADE = "#e4e0d8";

function wejdan() {
  const skin = "#e2ad89";
  return {
    id: "wejdan",
    tags: ["mayor", "woman", "hijab", "real-person", "waco"],
    sources: [
      { file: "Rogue_Hooded.glb", nodes: /^Rogue_(Body|Arm|Leg|Head_Hooded)/ },
    ],
    color(node, cell) {
      if (/Head/.test(node)) {
        if (cell === "1,1") return HIJAB; // hood -> hijab
        if (cell === "0,0") return skin;
        if (cell === "1,0") return null; // the rogue's side-swept bangs (see fringe())
        if (cell === "2,0") return "#2a1912"; // eyes and brows
      }
      if (/Body/.test(node)) {
        if (cell === "1,1") return HIJAB_SHADE; // the chest drape of the scarf
        if (cell === "3,0") return NAVY_DARK; // buckle
        if (cell === "5,0" || cell === "7,1") return NAVY_DARK;
        return NAVY;
      }
      if (/Arm/.test(node)) {
        if (cell === "5,2") return skin; // hands
        if (cell === "1,1") return NAVY_DARK; // cuffs
        return NAVY;
      }
      if (/Leg/.test(node)) {
        if (cell === "3,2") return "#2a2a30"; // shoes
        return NAVY_DARK;
      }
      return null;
    },
    mirror: (node, cell) => /Head/.test(node) && cell === "1,1",
    edit(node, cell, p) {
      // Every hood point is clamped inside a smooth dome around the head.
      if (/Head/.test(node) && cell === "1,1" && p[1] > 1.7) {
        const c = [0, 1.6, 0.01];
        const r = [0.57, 0.5, 0.6];
        const d = [
          (p[0] - c[0]) / r[0],
          (p[1] - c[1]) / r[1],
          (p[2] - c[2]) / r[2],
        ];
        const k = Math.hypot(d[0], d[1], d[2]);
        if (k > 1)
          return [
            c[0] + (p[0] - c[0]) / k,
            c[1] + (p[1] - c[1]) / k,
            c[2] + (p[2] - c[2]) / k,
          ];
      }
      return p;
    },
    parts: [
      skirt(NAVY, 0.45, 0.04),
      smile(skin, 0.0, "#b0705a"),
      fringe("#3b2418"),
      backDrape(HIJAB_SHADE),
    ],
  };
}

/** A little dark-brown hair at the front, parted in the middle under the headscarf. */
function fringe(color) {
  const part = new Part(color, J.head);
  const seg = 8;
  for (const s of [-1, 1]) {
    for (let i = 0; i < seg; i++) {
      const P = (k, dy) => {
        const x = s * (0.02 + (0.24 * k) / seg);
        const t = Math.abs(x) / 0.26;
        return [x, 1.75 - 0.07 * t * t + dy, 0.545 - 0.55 * x * x];
      };
      const q = [P(i, -0.03), P(i + 1, -0.03), P(i + 1, 0.015), P(i, 0.015)];
      if (s < 0) q.reverse();
      part.quad(q[0], q[1], q[2], q[3]);
    }
  }
  return part;
}

/** The headscarf falling down the upper back. */
function backDrape(color) {
  const part = new Part(color, (p) => [
    [J.chest, J.head, 0, 0],
    [p[1] > 1.2 ? 0.5 : 1, p[1] > 1.2 ? 0.5 : 0, 0, 0],
  ]);
  const top = ring(
    0,
    -0.02,
    1.27,
    0.3,
    0.33,
    10,
    Math.PI * 0.55,
    Math.PI * 1.45
  );
  const mid = ring(
    0,
    -0.02,
    1.08,
    0.38,
    0.37,
    10,
    Math.PI * 0.6,
    Math.PI * 1.4
  );
  const low = ring(
    0,
    -0.02,
    0.9,
    0.34,
    0.36,
    10,
    Math.PI * 0.72,
    Math.PI * 1.28
  );
  band(part, mid, top);
  band(part, low, mid);
  return part;
}

/** A long skirt / abaya hem from the waist to the ankles, following the legs a little. */
function skirt(color, yTop, yBottom) {
  const part = new Part(color, (p) => {
    // hips at the waist, then more of the leg on each side lower down
    const down = Math.min(1, Math.max(0, (yTop - p[1]) / (yTop - yBottom)));
    const side = Math.min(1, Math.abs(p[0]) / 0.25);
    const leg = 0.45 * down * side;
    const which = p[0] >= 0 ? J.upperlegL : J.upperlegR;
    return [
      [J.hips, which, 0, 0],
      [1 - leg, leg, 0, 0],
    ];
  });
  const rings = [
    ring(0, 0.02, yTop + 0.03, 0.37, 0.33, 14),
    ring(0, 0.02, yTop - 0.12, 0.4, 0.36, 14),
    ring(0, 0.03, yBottom + 0.12, 0.43, 0.38, 14),
    ring(0, 0.03, yBottom, 0.44, 0.39, 14),
  ];
  for (let i = 0; i + 1 < rings.length; i++) band(part, rings[i + 1], rings[i]);
  // a hem underside so the skirt has no hole when seen from below
  const r = rings[rings.length - 1];
  const inner = ring(0, 0.03, yBottom + 0.02, 0.33, 0.29, 14);
  band(part, r, inner);
  return part;
}

/** A gentle smile: a thin curved lip line on the lower face. */
function smile(_skin, open = 0, lip = "#b06a58", y0 = 1.425) {
  const part = new Part(lip, J.head);
  const seg = 6;
  const w = 0.16;
  for (let i = 0; i < seg; i++) {
    const a = -1 + (2 * i) / seg;
    const b = -1 + (2 * (i + 1)) / seg;
    const P = (s, dy) => [
      s * w,
      y0 + 0.035 * s * s + dy,
      0.47 - 1.7 * (s * w) ** 2,
    ];
    part.quad(
      P(a, -0.012 - open),
      P(b, -0.012 - open),
      P(b, 0.012),
      P(a, 0.012)
    );
  }
  return part;
}

/** Teeth for a big smile (white crescent under the lip line). */
function teeth(y0 = 1.418, w = 0.13) {
  const part = new Part("#f6f3ee", J.head);
  const seg = 6;

  for (let i = 0; i < seg; i++) {
    const a = -1 + (2 * i) / seg;
    const b = -1 + (2 * (i + 1)) / seg;
    const P = (s, dy) => [
      s * w,
      y0 + 0.04 * s * s + dy,
      0.466 - 1.7 * (s * w) ** 2,
    ];
    part.quad(
      P(a, -0.03 + 0.02 * a * a),
      P(b, -0.03 + 0.02 * b * b),
      P(b, 0),
      P(a, 0)
    );
  }
  return part;
}

function bahaa() {
  const skin = "#c08b67";
  const suit = "#16171b";
  return {
    id: "bahaa",
    tags: ["mayor", "man", "suit", "real-person", "khidmty"],
    sources: [
      { file: "Rogue.glb", nodes: /^Rogue_(Body|Arm|Leg)/ },
      { file: "Knight.glb", nodes: /^Knight_Head$/ },
      {
        file: "Barbarian.glb",
        nodes: /^Barbarian_Head$/,
        cells: ["1,0"],
        tag: "beard",
      },
    ],
    color(node, cell, c) {
      if (node === "beard") return cheekClear(c, 1.43) ? null : "#1b1512";
      if (/Head/.test(node)) {
        if (cell === "0,0") return skin;
        if (cell === "1,0") return "#1a1513"; // short dark hair, styled up and back
        if (cell === "2,0") return "#1a1210";
      }
      if (/Body/.test(node)) {
        if (cell === "1,1") return "#f4f4f2"; // white shirt front
        if (cell === "7,1") return "#101114";
        return suit;
      }
      if (/Arm/.test(node)) {
        if (cell === "5,2") return skin;
        if (cell === "1,1") return "#f4f4f2"; // shirt cuffs
        return suit;
      }
      if (/Leg/.test(node)) {
        if (cell === "3,2") return "#0e0e10"; // dark shoes
        return suit;
      }
      return null;
    },
    edit: friendlyBrows(trimBeard(0.4, 0.8)),
    parts: [
      tie("#6d1a26"),
      smile(null, 0.0, "#7a4636", 1.4),
      pocketSquare("#f6f6f4"),
      lapels(suit),
    ],
  };
}

/**
 * The knight head's brows slant down to the nose (a stern look): lift their inner ends so
 * the face reads friendly and relaxed.
 */
function friendlyBrows(edit) {
  return (node, cell, p) => {
    const q = edit ? edit(node, cell, p) : p;
    if (node !== "Knight_Head" || cell !== "1,0") return q;
    if (q[2] < 0.38 || q[1] > 1.76 || q[1] < 1.58) return q;
    const inner = Math.max(0, 1 - Math.abs(q[0]) / 0.28);
    return [q[0], q[1] + 0.035 * inner, q[2]];
  };
}

/** Bare cheeks above the beard line (between the moustache and the sideburns). */
function cheekClear(c, yMax) {
  const ax = Math.abs(c[0]);
  return ax > 0.15 && ax < 0.43 && c[1] > yMax;
}

/** Pull the barbarian's big beard close to the jaw (neatly trimmed) and thin it out. */
function trimBeard(depth, length) {
  return (node, _cell, p) => {
    if (node !== "beard") return p;
    // KayKit head: the lower face is a rounded muzzle, roughly z = 0.46 - 1.6 x^2 in front
    // of the mouth (y ~1.4); the chin is at y ~1.22. The beard is pulled in to hug the
    // face (neatly trimmed) and the chin part is shortened.
    const face = 0.46 - 1.6 * p[0] * p[0];
    const z = p[2] > face ? face + 0.012 + (p[2] - face) * depth : p[2];
    const cy = 1.38;
    const y = p[1] < cy ? cy - (cy - p[1]) * length : p[1];
    return [p[0], y, z];
  };
}

function tie(color) {
  const part = new Part(color, (p) => [
    [J.chest, J.spine, 0, 0],
    [p[1] > 0.9 ? 1 : 0.6, p[1] > 0.9 ? 0 : 0.4, 0, 0],
  ]);
  // knot
  box(part, [0, 1.17, 0.33], [0.07, 0.06, 0.04]);
  // blade, widening downwards, leaning with the chest surface
  box(part, [0, 0.93, 0.355], [0.07, 0.42, 0.02], (p, d) => [
    p[0] * (d[1] < 0 ? 1.6 : 1),
    p[1],
    p[2] + (d[1] < 0 ? 0.02 : -0.005),
  ]);
  return part;
}

function pocketSquare(color) {
  const part = new Part(color, J.chest);
  // left chest (the character's left is +x), a small folded square peeking out of the pocket
  box(part, [0.19, 1.04, 0.325], [0.085, 0.035, 0.02], (p, d) => [
    p[0],
    p[1] + (d[0] > 0 ? 0.012 : 0),
    p[2],
  ]);
  return part;
}

/** Two slim lapel wedges either side of the shirt front. */
function lapels(color) {
  const part = new Part(color, J.chest);
  for (const s of [-1, 1]) {
    const q = [
      [s * 0.05, 0.86, 0.36],
      [s * 0.16, 1.02, 0.345],
      [s * 0.17, 1.2, 0.3],
      [s * 0.07, 1.2, 0.33],
    ];
    if (s < 0) q.reverse();
    part.quad(q[0], q[1], q[2], q[3]);
  }
  return part;
}

function saleh() {
  const skin = "#cf9a74";
  const hoodie = "#141416";
  return {
    id: "saleh",
    tags: ["mayor", "man", "hoodie", "real-person", "saleh"],
    sources: [
      { file: "Rogue.glb", nodes: /^Rogue_(Body|Arm|Leg)/ },
      { file: "Knight.glb", nodes: /^Knight_Head$/ },
      {
        file: "Barbarian.glb",
        nodes: /^Barbarian_Head$/,
        cells: ["1,0"],
        tag: "beard",
      },
    ],
    color(node, cell, c) {
      if (node === "beard") return cheekClear(c, 1.38) ? null : "#1d1714";
      if (/Head/.test(node)) {
        if (cell === "0,0") return skin;
        if (cell === "1,0")
          return (c[1] < 1.78 && c[2] < 0.3) || c[2] < -0.25
            ? "#3a3029"
            : "#18130f"; // faded back and sides
        if (cell === "2,0") return "#1a1210";
      }
      if (/Body/.test(node)) {
        if (cell === "1,1") return "#7d7d80"; // grey ribbed turtleneck in the neckline
        if (cell === "6,0") return null; // the rogue's hip pouch and strap
        if (cell === "3,0" || cell === "7,1") return hoodie;
        if (cell === "5,0") return "#1d1d20"; // ribbed hem
        return hoodie;
      }
      if (/Arm/.test(node)) {
        if (cell === "5,2") return skin;
        if (cell === "1,1" || cell === "5,0") return "#1d1d20"; // cuffs
        return hoodie;
      }
      if (/Leg/.test(node)) {
        if (cell === "3,2") return "#2c2c30"; // casual shoes
        return "#222428";
      }
      return null;
    },
    edit: friendlyBrows((node, cell, p) => {
      if (node === "beard") return trimBeard(0.3, 0.7)(node, cell, p);
      // shorter hair: tuck the knight's quiff down a little
      if (/Head/.test(node) && cell === "1,0" && p[1] > 2.0)
        return [p[0], 2.0 + (p[1] - 2.0) * 0.6, p[2]];
      return p;
    }),
    parts: [
      drawstrings("#f2f2f0"),
      teeth(1.405, 0.14),
      smile(skin, 0.0, "#8a4a3c", 1.41),
    ],
  };
}

function drawstrings(color) {
  const part = new Part(color, J.chest);
  for (const s of [-1, 1]) {
    box(part, [s * 0.075, 1.0, 0.345], [0.022, 0.26, 0.022], (p, d) => [
      p[0] + (d[1] < 0 ? s * 0.01 : 0),
      p[1],
      p[2] + (d[1] < 0 ? 0.015 : 0),
    ]);
    // aglets
    box(part, [s * 0.085, 0.86, 0.362], [0.03, 0.04, 0.03]);
  }
  return part;
}

function eyad() {
  const skin = "#cfa27c"; // neutral warm light-olive (the reference photo is black and white)
  const hoodie = "#2e3034";
  return {
    id: "eyad",
    tags: ["mayor", "man", "hoodie", "sunglasses", "real-person", "eyad"],
    sources: [
      { file: "Rogue.glb", nodes: /^Rogue_(Body|Arm|Leg)/ },
      { file: "Knight.glb", nodes: /^Knight_Head$/ },
      {
        file: "Barbarian.glb",
        nodes: /^Barbarian_Head$/,
        cells: ["1,0"],
        tag: "beard",
      },
    ],
    color(node, cell, c) {
      if (node === "beard") return cheekClear(c, 1.47) ? null : "#1a1411";
      if (/Head/.test(node)) {
        if (cell === "0,0") return skin;
        if (cell === "1,0")
          return c[1] < 1.72 && c[2] < 0.3 ? "#2b231e" : "#16120f"; // textured top, shorter sides
        if (cell === "2,0") return "#1a1210";
      }
      if (/Body/.test(node)) {
        if (cell === "1,1") return "#26282c"; // the hood, down, around the neck
        if (cell === "6,0") return null; // the rogue's hip pouch and strap
        if (cell === "3,0" || cell === "7,1") return hoodie;
        if (cell === "5,0") return "#26282c";
        return hoodie;
      }
      if (/Arm/.test(node)) {
        if (cell === "5,2") return skin;
        if (cell === "1,1" || cell === "5,0") return "#26282c";
        return hoodie;
      }
      if (/Leg/.test(node)) {
        if (cell === "3,2") return "#141416";
        return "#1c1d21";
      }
      return null;
    },
    edit: friendlyBrows(trimBeard(0.65, 0.95)),
    parts: [sunglasses()],
  };
}

/** Round sunglasses: two round lenses, one straight bridge, temple arms back to the ears. */
function sunglasses() {
  const part = new Part("#0c0c0e", J.head);
  const y = 1.6;
  const z = 0.47;
  for (const s of [-1, 1]) {
    lens(part, [s * 0.135, y, z], 0.085, 0.025, 12, s * 0.12);
    // temple arm along the side of the head
    box(part, [s * 0.235, y + 0.03, z - 0.2], [0.02, 0.02, 0.38], (p) => [
      p[0] + s * 0.06 * ((z - p[2]) / 0.4),
      p[1],
      p[2],
    ]);
  }
  // one straight bridge
  box(part, [0, y + 0.03, z + 0.01], [0.11, 0.018, 0.018]);
  return part;
}

function anas() {
  const skin = "#c99068";
  const sweater = "#1b2033";
  return {
    id: "anas",
    tags: ["mayor", "man", "sweater", "real-person", "teryaq"],
    sources: [
      { file: "Rogue.glb", nodes: /^Rogue_(Body|Arm|Leg)/ },
      { file: "Knight.glb", nodes: /^Knight_Head$/ },
      {
        file: "Barbarian.glb",
        nodes: /^Barbarian_Head$/,
        cells: ["1,0"],
        tag: "beard",
      },
    ],
    color(node, cell, c) {
      // clean-shaven except a full moustache: keep only the beard's upper-lip triangles
      if (node === "beard")
        return c[1] > 1.4 && c[1] < 1.5 && c[2] > 0.3 && Math.abs(c[0]) < 0.24
          ? "#1a1411"
          : null;
      if (/Head/.test(node)) {
        if (cell === "0,0") return skin;
        if (cell === "1,0")
          return c[1] < 1.75 && c[2] < 0.3 ? "#2a221d" : "#17120f"; // short textured top, short sides
        if (cell === "2,0") return "#1a1210";
      }
      if (/Body/.test(node)) {
        if (cell === "6,0") return null;
        if (cell === "3,0" || cell === "7,1") return sweater;
        if (cell === "5,0") return "#151a2a"; // ribbed hem
        return sweater; // the neckerchief is sweater too: a plain crew neck
      }
      if (/Arm/.test(node)) {
        if (cell === "5,2") return skin;
        return sweater;
      }
      if (/Leg/.test(node)) {
        if (cell === "3,2") return "#1a1a1d";
        return "#202227";
      }
      return null;
    },
    edit: friendlyBrows((node, cell, p) => {
      if (/Head/.test(node) && cell === "1,0" && p[1] > 2.0)
        return [p[0], 2.0 + (p[1] - 2.0) * 0.5, p[2]];
      return p;
    }),
    parts: [teeth(1.392, 0.15), smile(skin, 0.0, "#8a4a3c", 1.398)],
  };
}

const SPECS = [wejdan, bahaa, saleh, eyad, anas];

// ---------------------------------------------------------------- texture atlas
const GRID = 8;
const TEX = 256;

/** A palette atlas: one swatch per colour, each a gentle vertical gradient like the KayKit atlases. */
async function buildAtlas(colors) {
  const cell = TEX / GRID;
  const buf = Buffer.alloc(TEX * TEX * 4);
  colors.forEach((hex, i) => {
    const [r, g, b] = hexRgb(hex);
    const cx = (i % GRID) * cell;
    const cy = Math.floor(i / GRID) * cell;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const f =
          (1.06 - 0.22 * (y / (cell - 1))) * (x / cell > 0.84 ? 0.95 : 1);
        const o = ((cy + y) * TEX + cx + x) * 4;
        buf[o] = Math.min(255, Math.round(r * f));
        buf[o + 1] = Math.min(255, Math.round(g * f));
        buf[o + 2] = Math.min(255, Math.round(b * f));
        buf[o + 3] = 255;
      }
    }
  });
  return sharp(buf, { raw: { width: TEX, height: TEX, channels: 4 } })
    .png({ palette: true, compressionLevel: 9, effort: 10 })
    .toBuffer();
}

// ---------------------------------------------------------------- animation helpers (from curate.mjs)
function disposeAnimation(anim) {
  for (const sampler of anim.listSamplers()) sampler.dispose();
  for (const channel of anim.listChannels()) channel.dispose();
  anim.dispose();
}

function filterAnimations(doc, keep) {
  const kept = [];
  for (const anim of doc.getRoot().listAnimations()) {
    if (!keep.includes(anim.getName())) {
      disposeAnimation(anim);
      continue;
    }
    for (const ch of anim.listChannels()) {
      if (!ch.getTargetNode()) {
        ch.getSampler()?.dispose();
        ch.dispose();
      }
    }
    kept.push(anim.getName());
  }
  return keep.filter((k) => kept.includes(k));
}

function dropRestChannels(doc) {
  const EPS = 1e-4;
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      const sampler = ch.getSampler();
      const out = sampler?.getOutput()?.getArray();
      if (!node || !out) continue;
      const p = ch.getTargetPath();
      const rest =
        p === "translation"
          ? node.getTranslation()
          : p === "rotation"
            ? node.getRotation()
            : p === "scale"
              ? node.getScale()
              : null;
      if (!rest) continue;
      let same = true;
      for (let i = 0; i < out.length && same; i++)
        if (Math.abs(out[i] - rest[i % rest.length]) > EPS) same = false;
      if (same) {
        sampler.dispose();
        ch.dispose();
      }
    }
  }
}

function dropHelperJointChannels(doc, deformJoints) {
  const keep = new Set();
  for (const joint of deformJoints)
    for (let n = joint; n; n = n.getParentNode()) keep.add(n);
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      if (node && !keep.has(node)) {
        ch.getSampler()?.dispose();
        ch.dispose();
      }
    }
  }
}

function quantizeRotations(doc) {
  const done = new Set();
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      if (ch.getTargetPath() !== "rotation") continue;
      const acc = ch.getSampler()?.getOutput();
      const src = acc?.getArray();
      if (!acc || !(src instanceof Float32Array) || done.has(acc)) continue;
      const dst = new Int16Array(src.length);
      for (let i = 0; i < src.length; i++)
        dst[i] = Math.round(Math.max(-1, Math.min(1, src[i] ?? 0)) * 32767);
      acc.setArray(dst).setNormalized(true);
      done.add(acc);
    }
  }
}

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------- build one character
async function build(io, sourceDir, spec) {
  const base = await io.read(path.join(sourceDir, spec.sources[0].file));
  const root = base.getRoot();
  const skin = root.listSkins()[0];
  const rig = root.listNodes().find((n) => n.getName() === "Rig");
  const joints = skin.listJoints();

  const soup = new Soup();
  const colors = [];
  const colorIndex = new Map();
  const triColor = [];
  const colorSlot = (hex) => {
    if (!colorIndex.has(hex)) {
      colorIndex.set(hex, colors.length);
      colors.push(hex);
    }
    return colorIndex.get(hex);
  };
  const removed = [];

  // Source triangles (head, body, arms, legs), recoloured.
  const bodyVerts = [];
  for (const [i, s] of spec.sources.entries()) {
    const doc = i === 0 ? base : await io.read(path.join(sourceDir, s.file));
    for (const node of doc.getRoot().listNodes()) {
      if (!node.getMesh()) continue;
      if (!s.nodes.test(node.getName())) continue;
      const tag = s.tag ?? node.getName();
      for (const t of readTriangles(node)) {
        if (s.cells && !s.cells.includes(t.cell)) continue;
        // the barbarian's bushy eyebrows: keep the head's own
        if (s.tag === "beard" && t.centroid[1] > 1.6) continue;
        // and keep the lips clear for the smile
        if (
          s.tag === "beard" &&
          Math.abs(t.centroid[0]) < 0.13 &&
          t.centroid[1] > 1.36 &&
          t.centroid[1] < 1.415
        )
          continue;
        const hex = spec.color(tag, t.cell, t.centroid);
        if (!hex) continue;
        const ci = colorSlot(hex);
        // Mirrored parts: keep the +x half and copy it to -x (a symmetric headscarf).
        const mirror = spec.mirror?.(tag, t.cell) ?? false;
        if (mirror && t.centroid[0] < 0) continue;
        for (const k of t.corners) {
          const p = spec.edit ? spec.edit(tag, t.cell, k.p) : k.p;
          soup.corner(p, k.n, k.j, k.w, k.uvf);
          if (/Body/.test(tag)) bodyVerts.push(p);
        }
        triColor.push(ci);
        if (mirror) {
          for (const k of [...t.corners].reverse()) {
            const p = spec.edit ? spec.edit(tag, t.cell, k.p) : k.p;
            soup.corner(
              [-p[0], p[1], p[2]],
              [-k.n[0], k.n[1], k.n[2]],
              k.j,
              k.w,
              k.uvf
            );
          }
          triColor.push(ci);
        }
      }
    }
  }

  // Procedural parts (flat normals).
  for (const part of spec.parts) {
    const ci = colorSlot(part.color);
    for (const tri of part.tris) {
      const n = nrmz(crs(sub(tri[1], tri[0]), sub(tri[2], tri[0])));
      for (const p of tri) {
        const [j, w] =
          typeof part.weight === "function"
            ? part.weight(p)
            : [
                [part.weight, 0, 0, 0],
                [1, 0, 0, 0],
              ];
        // swatch v follows height a little so long pieces get a gradient
        soup.corner(p, n, j, w, [0.4, clamp01(0.5 - (p[1] - 1) * 0.3)]);
      }
      triColor.push(ci);
    }
  }

  // Drop every source mesh node; one merged skinned mesh replaces them.
  for (const node of root.listNodes()) {
    if (!node.getMesh()) continue;
    if (DROP_NODES.test(node.getName())) removed.push(node.getName());
    node.setMesh(null);
    if (!node.getSkin() && !joints.includes(node) && node !== rig) {
      // rigid attachments (weapons, hats, capes) are plain nodes under bones
      if (node.listChildren().length === 0) node.dispose();
    }
  }
  for (const node of root.listNodes())
    if (node.getSkin() && !joints.includes(node)) node.dispose();

  // Merged attributes, UVs remapped into the new atlas.
  const n = soup.count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const ci = triColor[Math.floor(i / 3)];
    const cx = ci % GRID;
    const cy = Math.floor(ci / GRID);
    uv[i * 2] = (cx + soup.uvf[i * 2]) / GRID;
    uv[i * 2 + 1] = (cy + soup.uvf[i * 2 + 1]) / GRID;
  }
  // normalise weights
  const wgt = new Float32Array(soup.wgt);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += wgt[i * 4 + k];
    for (let k = 0; k < 4; k++)
      wgt[i * 4 + k] = s > 0 ? wgt[i * 4 + k] / s : k === 0 ? 1 : 0;
  }
  const buffer = root.listBuffers()[0] ?? base.createBuffer();
  const acc = (type, arr) =>
    base.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const atlas = await buildAtlas(colors);
  const texture = base
    .createTexture(`${spec.id}_palette`)
    .setImage(new Uint8Array(atlas))
    .setMimeType("image/png");
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) if (t !== texture) t.dispose();
  const material = base
    .createMaterial(`${spec.id}_material`)
    .setBaseColorTexture(texture)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.9);
  const prim = base
    .createPrimitive()
    .setAttribute("POSITION", acc("VEC3", new Float32Array(soup.pos)))
    .setAttribute("NORMAL", acc("VEC3", new Float32Array(soup.nrm)))
    .setAttribute("TEXCOORD_0", acc("VEC2", uv))
    .setAttribute("JOINTS_0", acc("VEC4", new Uint16Array(soup.jnt)))
    .setAttribute("WEIGHTS_0", acc("VEC4", wgt))
    .setMaterial(material);
  const mesh = base.createMesh(`${spec.id}_mesh`).addPrimitive(prim);
  const body = base.createNode(`${spec.id}_body`).setMesh(mesh).setSkin(skin);
  rig.addChild(body);

  const clips = filterAnimations(base, KAYKIT_CLIPS);
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const b = getBounds(scene);
  const native = [0, 1, 2].map((i) => b.max[i] - b.min[i]);
  const scale = CHARACTER_HEIGHT / native[1];

  const deform = new Set();
  for (let i = 0; i < n; i++)
    for (let k = 0; k < 4; k++)
      if (wgt[i * 4 + k] > 1e-3) deform.add(joints[soup.jnt[i * 4 + k]]);

  await base.transform(
    dedup(),
    prune({ keepLeaves: false }),
    weld(),
    resample({ tolerance: 5e-4 }),
    quantize(),
    prune()
  );
  dropRestChannels(base);
  dropHelperJointChannels(base, deform);
  quantizeRotations(base);
  await base.transform(prune());

  const file = `character-${spec.id}.glb`;
  const out = path.join(OUT_DIR, file);
  await io.write(out, base);
  const bytes = (await fs.stat(out)).size;
  const size = native.map((v) => round(v * scale));
  console.log(
    `character-${spec.id}  ${(bytes / 1024).toFixed(1)} KB  ${n / 3} tris  ${colors.length} colours`
  );
  return [
    `character-${spec.id}`,
    {
      file,
      source: "kaykit-adventurers (modified)",
      license: "CC0",
      kind: "character",
      footprint: [round(size[0], 2), round(size[2], 2)],
      footprintUnit: "m",
      height: round(native[1] * scale),
      scale: round(scale, 4),
      size,
      minY: round(b.min[1] * scale),
      tags: spec.tags,
      animations: clips,
      solid: true,
      lazy: true,
      bytes,
      stripped: [...new Set(removed)],
      notes:
        "Kit-bashed from KayKit Adventurers 1.0 rigs (CC0) by scripts/3d/people.mjs: recoloured, extra procedural pieces, weapons/hats/capes removed. A stylized mayor for a real person, not a selectable player.",
      banned: false,
      reason: "",
    },
  ];
}

async function main() {
  const sourceDir = path.resolve(process.argv[2] ?? DEFAULT_SOURCE);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const only = process.env.ONLY?.split(",");
  let models = {};
  try {
    models = JSON.parse(await fs.readFile(FRAGMENT, "utf8")).models ?? {};
  } catch {
    models = {};
  }
  for (const make of SPECS) {
    const spec = make();
    if (only && !only.includes(spec.id)) continue;
    const [name, entry] = await build(io, sourceDir, spec);
    models[name] = entry;
  }
  await fs.writeFile(FRAGMENT, `${JSON.stringify({ models }, null, 2)}\n`);
}

await main();
