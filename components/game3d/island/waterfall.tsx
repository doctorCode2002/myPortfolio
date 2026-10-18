"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { sharedUniforms } from "../fx/shared-time";
import { createWaterfallMaterial } from "../fx/water";
import type { Point2 } from "../logic/hex";
import type { WalkCell } from "../logic/walk-grid";
import { useRuntimeRef } from "../runtime";
import { buildWaterfallGeometry, createMistTexture } from "./geometry";
import { assign } from "../fx/assign";

const MIST = 22;

/** A scrolling ribbon falling off the island rim at a hex, with mist puffs at its foot. */
export function Waterfall({
  cell,
  centroid,
  size,
  rim,
  topY,
  length,
}: {
  cell: WalkCell;
  /** Where the ribbon leaves the island lip (world x, z). */
  rim?: { x: number; z: number };
  centroid: Point2;
  size: number;
  topY: number;
  length: number;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const { geometry, material, mistGeo, mistMat, bottom, seeds } =
    useMemo(() => {
      const outward = new THREE.Vector3(
        cell.x - centroid.x,
        0,
        cell.z - centroid.z
      );
      if (outward.lengthSq() < 1e-6) outward.set(0, 0, 1);
      outward.normalize();
      const start = rim
        ? new THREE.Vector3(rim.x, topY, rim.z)
        : new THREE.Vector3(cell.x, topY, cell.z).addScaledVector(
            outward,
            size * 0.82
          );
      const geometry = buildWaterfallGeometry(
        start,
        outward,
        length,
        size * 0.9
      );
      const bottom = start.clone().addScaledVector(outward, 0.9);
      bottom.y -= length * 0.95;
      const seeds = Array.from({ length: MIST }, (_, i) => ({
        a: (i / MIST) * Math.PI * 2,
        r: 0.3 + ((i * 37) % 10) / 14,
        phase: ((i * 53) % 17) / 17,
      }));
      const mistGeo = new THREE.BufferGeometry();
      mistGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Float32Array(MIST * 3), 3)
      );
      const mistMat = new THREE.PointsMaterial({
        size: 1.1,
        map: createMistTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
        color: "#f4fbff",
      });
      return {
        geometry,
        material: createWaterfallMaterial(),
        mistGeo,
        mistMat,
        bottom,
        seeds,
      };
    }, [cell, centroid, size, topY, length, rim]);

  const updated = useRef(false);
  useFrame(({ clock }) => {
    const rt = rtRef.current;
    // Heavier mist in the rain.
    const rain = sharedUniforms.uRain.value;
    assign(mistMat, "opacity", 0.7 + rain * 0.25);
    assign(mistMat, "size", 1.1 * (1 + rain * 0.6));
    if (rt.reducedMotion && updated.current) return;
    updated.current = true;
    const t = rt.reducedMotion ? 0 : clock.elapsedTime;
    const attr = mistGeo.getAttribute("position") as THREE.BufferAttribute;
    seeds.forEach((s, i) => {
      const k = (t * 0.35 + s.phase) % 1;
      attr.setXYZ(
        i,
        bottom.x + Math.cos(s.a) * s.r * (0.6 + k),
        bottom.y + k * 1.4,
        bottom.z + Math.sin(s.a) * s.r * (0.6 + k)
      );
    });
    attr.needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={geometry} material={material} renderOrder={2} />
      <points
        geometry={mistGeo}
        material={mistMat}
        renderOrder={3}
        frustumCulled={false}
      />
    </group>
  );
}
