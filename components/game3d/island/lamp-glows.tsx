"use client";

import { useMemo, type ReactNode } from "react";
import * as THREE from "three";

import { createMistTexture } from "./geometry";

export type Glow = { x: number; y: number; z: number };

/**
 * Warm additive halos on lamps and lanterns: a cheap stand-in for bloom (one sprite each,
 * no post-processing pass).
 */
export function LampGlows({ glows }: { glows: readonly Glow[] }): ReactNode {
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: createMistTexture(),
        color: "#ffc477",
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  );
  return (
    <>
      {glows.map((g, i) => (
        <sprite
          key={i}
          position={[g.x, g.y, g.z]}
          scale={[0.9, 0.9, 0.9]}
          material={material}
        />
      ))}
    </>
  );
}
