"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { live } from "../atmosphere/live";
import { createRng } from "../logic/noise";
import { assign } from "../fx/assign";

const COUNT = 18;
const SPAN = 180;

/** A low-poly puff: a few flat-shaded icosahedra merged into one geometry. */
function cloudGeometry(seed: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const blobs = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const r = 0.8 + rng() * 0.9;
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1, 0.7, 1);
    g.translate(
      (i - blobs / 2) * 1.1 + rng() * 0.4,
      rng() * 0.5,
      (rng() - 0.5) * 1.2
    );
    g.deleteAttribute("uv");
    parts.push(g);
  }
  const merged = mergeGeometries(parts) ?? new THREE.IcosahedronGeometry(1, 0);
  merged.computeVertexNormals();
  return merged;
}

type Cloud = {
  variant: number;
  x: number;
  y: number;
  z: number;
  s: number;
  speed: number;
  rot: number;
};

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();

function placeClouds(
  t: number,
  clouds: readonly Cloud[],
  meshes: readonly (THREE.InstancedMesh | null)[],
  center: { x: number; z: number }
): void {
  const counters = [0, 0];
  for (const c of clouds) {
    const mesh = meshes[c.variant];
    if (!mesh) continue;
    let x = c.x + t * c.speed;
    x = ((((x + SPAN / 2) % SPAN) + SPAN) % SPAN) - SPAN / 2;
    tmpV.set(center.x + x, c.y, center.z + c.z);
    tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, c.rot);
    tmpS.setScalar(c.s);
    const idx = counters[c.variant] ?? 0;
    mesh.setMatrixAt(idx, tmpM.compose(tmpV, tmpQ, tmpS));
    counters[c.variant] = idx + 1;
  }
  for (const mesh of meshes) if (mesh) mesh.instanceMatrix.needsUpdate = true;
}

/** Drifting clouds around and below the islands (static under reduced motion). */
export function Clouds({
  center,
  reducedMotion,
}: {
  center: { x: number; z: number };
  reducedMotion: boolean;
}): ReactNode {
  const ref0 = useRef<THREE.InstancedMesh>(null);
  const ref1 = useRef<THREE.InstancedMesh>(null);
  const geos = useMemo(() => [cloudGeometry(11), cloudGeometry(29)], []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#fff6ee",
        emissive: "#f7d9c2",
        emissiveIntensity: 0.25,
        roughness: 1,
        flatShading: true,
      }),
    []
  );
  const clouds = useMemo((): Cloud[] => {
    const rng = createRng(4);
    return Array.from({ length: COUNT }, (_, i) => {
      const below = i % 3 === 0;
      return {
        variant: i % 2,
        x: (rng() - 0.5) * SPAN,
        y: below ? -12 - rng() * 10 : 6 + rng() * 14,
        z: (rng() - 0.5) * SPAN,
        s: (below ? 2.2 : 1.4) + rng() * 1.6,
        speed: 0.4 + rng() * 0.5,
        rot: rng() * Math.PI,
      };
    });
  }, []);
  useLayoutEffect(() => {
    placeClouds(0, clouds, [ref0.current, ref1.current], center);
  }, [clouds, center]);
  useFrame(({ clock }) => {
    // Tinted by the time of day and the weather.
    material.color.copy(live.cloudColor);
    material.emissive.copy(live.cloudEmissive);
    assign(material, "emissiveIntensity", live.cloudGlow);
    if (!reducedMotion)
      placeClouds(
        clock.elapsedTime,
        clouds,
        [ref0.current, ref1.current],
        center
      );
  });

  const counts = [
    clouds.filter((c) => c.variant === 0).length,
    clouds.filter((c) => c.variant === 1).length,
  ];
  return (
    <>
      {geos.map((g, i) => (
        <instancedMesh
          key={i}
          ref={i === 0 ? ref0 : ref1}
          args={[g, material, counts[i] ?? 0]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}
