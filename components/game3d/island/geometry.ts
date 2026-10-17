import * as THREE from "three";

import { hexKey, hexNeighbours } from "../logic/hex";
import type { UndersideData } from "../logic/underside";
import type { WalkCell } from "../logic/walk-grid";

/**
 * One merged geometry for all water hexes of an island: each hex is six sectors with an
 * inner ring at 70% radius; rim vertices carry aFoam = 1 where they touch land.
 */
export function buildWaterGeometry(
  cells: readonly WalkCell[],
  isWater: (q: number, r: number) => boolean,
  size: number,
  yOffset: number
): THREE.BufferGeometry {
  const pos: number[] = [];
  const foam: number[] = [];
  const corner = (i: number): [number, number] => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [Math.cos(a), Math.sin(a)];
  };
  for (const cell of cells) {
    const nb = hexNeighbours(cell.q, cell.r);
    // Corner i sits between edge directions; it touches land if either adjacent neighbour is not water.
    const cornerFoam: number[] = [];
    for (let i = 0; i < 6; i++) {
      // Corner i (angle 60i-30) lies between neighbours at angles 60i-60 and 60i (axial dirs, z flipped).
      const dirA = nb[(6 - i) % 6] as { q: number; r: number };
      const dirB = nb[(7 - i) % 6] as { q: number; r: number };
      cornerFoam.push(
        isWater(dirA.q, dirA.r) && isWater(dirB.q, dirB.r) ? 0 : 1
      );
    }
    const y = cell.y + yOffset;
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const [ax, az] = corner(i);
      const [bx, bz] = corner(j);
      const o = [cell.x, y, cell.z];
      const ai = [cell.x + ax * size * 0.7, y, cell.z + az * size * 0.7];
      const bi = [cell.x + bx * size * 0.7, y, cell.z + bz * size * 0.7];
      const ao = [cell.x + ax * size, y, cell.z + az * size];
      const bo = [cell.x + bx * size, y, cell.z + bz * size];
      const fa = cornerFoam[i] as number;
      const fb = cornerFoam[j] as number;
      // Inner triangle (centre, b-inner, a-inner): counter-clockwise seen from above.
      pos.push(...o, ...bi, ...ai);
      foam.push(0, 0, 0);
      // Outer quad.
      pos.push(...ai, ...bi, ...bo, ...ai, ...bo, ...ao);
      foam.push(0, 0, fb, 0, fb, fa);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aFoam", new THREE.Float32BufferAttribute(foam, 1));
  g.computeVertexNormals();
  return g;
}

/** Waterfall ribbon from a rim point falling outward and down; uv.y runs 0 (top) to 1 (bottom). */
export function buildWaterfallGeometry(
  start: THREE.Vector3,
  outward: THREE.Vector3,
  length: number,
  width: number
): THREE.BufferGeometry {
  const rows = 14;
  const side = new THREE.Vector3(-outward.z, 0, outward.x).normalize();
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const s = i / rows;
    // A short lip outward, then mostly straight down with a slight spread.
    const out = 0.5 * Math.sqrt(s) + s * 0.4;
    const down = s * s * 0.25 * length + s * 0.75 * length;
    const w = width * (1 + s * 0.35);
    for (const k of [0, 1]) {
      const p = start
        .clone()
        .addScaledVector(outward, out)
        .addScaledVector(side, (k - 0.5) * w);
      p.y -= down;
      pos.push(p.x, p.y, p.z);
      uv.push(k, s);
    }
    if (i < rows) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function undersideGeometry(data: UndersideData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  g.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Soft round sprite for mist particles. */
export function createMistTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export { hexKey };

/**
 * A continuous grass skin over flat grass hexes: each hex is 24 small triangles a hair
 * above the tile top, vertex-coloured from one world-space meadow field (no per-tile
 * pattern, so neighbouring hexes read as one lawn and the KayKit bevels disappear).
 */
export function buildGrassSkin<C extends { x: number; z: number; y: number }>(
  cells: readonly C[],
  size: number,
  colorAt: (x: number, z: number, cell: C) => [number, number, number],
  heightAt: (x: number, z: number, cellY: number) => number
): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const corner = (i: number): [number, number] => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [Math.cos(a) * size * 1.002, Math.sin(a) * size * 1.002];
  };
  const push = (x: number, z: number, cell: C): void => {
    pos.push(x, heightAt(x, z, cell.y), z);
    const c = colorAt(x, z, cell);
    col.push(c[0], c[1], c[2]);
  };
  for (const cell of cells) {
    for (let i = 0; i < 6; i++) {
      const [ax, az] = corner(i);
      const [bx, bz] = corner((i + 1) % 6);
      // Sector (centre, b, a) subdivided into four triangles via edge midpoints.
      const P = [
        [cell.x, cell.z],
        [cell.x + bx, cell.z + bz],
        [cell.x + ax, cell.z + az],
      ] as [number, number][];
      const m01: [number, number] = [
        (P[0]![0] + P[1]![0]) / 2,
        (P[0]![1] + P[1]![1]) / 2,
      ];
      const m12: [number, number] = [
        (P[1]![0] + P[2]![0]) / 2,
        (P[1]![1] + P[2]![1]) / 2,
      ];
      const m20: [number, number] = [
        (P[2]![0] + P[0]![0]) / 2,
        (P[2]![1] + P[0]![1]) / 2,
      ];
      const tris: [number, number][][] = [
        [P[0]!, m01, m20],
        [m01, P[1]!, m12],
        [m20, m12, P[2]!],
        [m01, m12, m20],
      ];
      for (const t of tris) for (const v of t) push(v[0], v[1], cell);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export type TerraceWall = {
  /** Edge end points (world x, z), ordered clockwise seen from above around the cell. */
  ax: number;
  az: number;
  bx: number;
  bz: number;
  top: number;
  bottom: number;
  lip: [number, number, number];
  soil: [number, number, number];
};

const ROCK: [number, number, number] = [0.3, 0.24, 0.2];

/**
 * Vertical faces for the exposed edges of skinned hexes (terrace sides, banks, rim):
 * a thin grass (or sand) lip, soil below, and rock on tall faces. Flat-shaded quads with
 * vertex colours, all in one geometry; replaces the bevelled KayKit tile sides.
 */
export function buildTerraceWalls(
  walls: readonly TerraceWall[]
): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const quad = (
    a: [number, number],
    b: [number, number],
    y0: number,
    y1: number,
    c: [number, number, number],
    jitter: number
  ): void => {
    if (y0 - y1 < 1e-3) return;
    const k = 0.92 + jitter * 0.14;
    const cc: [number, number, number] = [c[0] * k, c[1] * k, c[2] * k];
    const A = [a[0], y0, a[1]];
    const B = [b[0], y0, b[1]];
    const C = [b[0], y1, b[1]];
    const D = [a[0], y1, a[1]];
    pos.push(...A, ...B, ...D, ...B, ...C, ...D);
    for (let i = 0; i < 6; i++) col.push(cc[0], cc[1], cc[2]);
  };
  walls.forEach((w, i) => {
    const a: [number, number] = [w.ax, w.az];
    const b: [number, number] = [w.bx, w.bz];
    const h = w.top - w.bottom;
    const j = ((i * 7919) % 13) / 13;
    const lipBottom = w.top - Math.min(0.12, h);
    quad(a, b, w.top, lipBottom, w.lip, j);
    const soilBottom = h > 0.75 ? w.top - 0.55 : w.bottom;
    quad(a, b, lipBottom, soilBottom, w.soil, j);
    if (h > 0.75) quad(a, b, soilBottom, w.bottom, ROCK, j);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
