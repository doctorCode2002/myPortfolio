"use client";

/**
 * A low-poly paraglider, built in code: one curved, cambered canopy (a strip of cells
 * along an arc, alternating colours) and its suspension lines. The lines of each half
 * fan down to that side's riser, so lines only ever meet at a shared end: no crossings,
 * no cross-shaped frame. Origin at the pilot's feet; the canopy faces +z.
 */

import { forwardRef, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";

const CELLS = 8;
const SPAN_ANGLE = (62 * Math.PI) / 180;
const ARC_R = 1.9;
/** Canopy height above the pilot's feet, and the risers' (about shoulder height). */
const CANOPY_Y = 2.55;
const RISER_Y = 1.3;
const RISER_X = 0.24;
const CHORD_FRONT = 0.55;
const CHORD_BACK = -0.5;
const CHORD_STEPS = 4;

const COLORS = ["#f08a3c", "#f7e7c4"] as const;

/** Canopy point at span parameter u (-1..1) and chord parameter c (0 front .. 1 back). */
function canopyPoint(u: number, c: number, out: THREE.Vector3): THREE.Vector3 {
  const a = u * SPAN_ANGLE;
  const camber = 0.13 * Math.sin(Math.PI * c) * (1 - 0.35 * Math.abs(u));
  const r = ARC_R + camber;
  out.set(
    Math.sin(a) * r,
    CANOPY_Y - ARC_R + Math.cos(a) * r,
    CHORD_FRONT + (CHORD_BACK - CHORD_FRONT) * c
  );
  return out;
}

function buildCanopy(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const p = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  const color = new THREE.Color();
  for (let i = 0; i < CELLS; i++) {
    const u0 = -1 + (2 * i) / CELLS;
    const u1 = -1 + (2 * (i + 1)) / CELLS;
    color.set(COLORS[i % 2] ?? COLORS[0]);
    for (let j = 0; j < CHORD_STEPS; j++) {
      const c0 = j / CHORD_STEPS;
      const c1 = (j + 1) / CHORD_STEPS;
      const [a, b, c, d] = p as [
        THREE.Vector3,
        THREE.Vector3,
        THREE.Vector3,
        THREE.Vector3,
      ];
      canopyPoint(u0, c0, a);
      canopyPoint(u1, c0, b);
      canopyPoint(u1, c1, c);
      canopyPoint(u0, c1, d);
      for (const v of [a, b, c, a, c, d]) {
        pos.push(v.x, v.y, v.z);
        col.push(color.r, color.g, color.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function buildLines(): THREE.BufferGeometry {
  const pos: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= CELLS; i++) {
    const u = -1 + (2 * i) / CELLS;
    if (Math.abs(u) < 1e-6) continue; // no centre line: the halves stay apart
    const rx = u < 0 ? -RISER_X : RISER_X;
    for (const c of [0.15, 0.8]) {
      canopyPoint(u, c, v);
      pos.push(v.x, v.y - 0.02, v.z, rx, RISER_Y, 0.02);
    }
  }
  // Risers down to the harness at the hips.
  pos.push(-RISER_X, RISER_Y, 0.02, -0.18, 0.95, 0);
  pos.push(RISER_X, RISER_Y, 0.02, 0.18, 0.95, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** The glider rig (canopy and lines); pose it with the ref'd group. */
export const GliderModel = forwardRef<THREE.Group, { visible?: boolean }>(
  function GliderModel({ visible = false }, ref): ReactNode {
    const canopy = useMemo(buildCanopy, []);
    const lines = useMemo(buildLines, []);
    const canopyMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          side: THREE.DoubleSide,
          roughness: 0.75,
        }),
      []
    );
    const lineMat = useMemo(
      () =>
        new THREE.LineBasicMaterial({
          color: "#3b3530",
          transparent: true,
          opacity: 0.75,
        }),
      []
    );
    useEffect(
      () => () => {
        canopy.dispose();
        lines.dispose();
        canopyMat.dispose();
        lineMat.dispose();
      },
      [canopy, lines, canopyMat, lineMat]
    );
    return (
      <group ref={ref} name="glider" visible={visible}>
        <mesh geometry={canopy} material={canopyMat} castShadow />
        <lineSegments geometry={lines} material={lineMat} />
      </group>
    );
  }
);
