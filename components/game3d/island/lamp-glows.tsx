"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { propScale } from "../logic/breakables";
import { useOptionalRuntimeRef } from "../runtime";
import { createMistTexture } from "./geometry";

/** A lamp halo; `key` is the lamp's object key, so a smashed lamp goes dark. */
export type Glow = { x: number; y: number; z: number; key?: string };

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
  const rtRef = useOptionalRuntimeRef();
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const version = useRef(-1);
  useFrame(() => {
    const store = rtRef?.current.props;
    if (!store || store.version === version.current) return;
    version.current = store.version;
    const now = performance.now();
    glows.forEach((g, i) => {
      const s = sprites.current[i];
      if (s && g.key) s.visible = propScale(store, g.key, now) > 0.9;
    });
  });
  return (
    <>
      {glows.map((g, i) => (
        <sprite
          key={i}
          ref={(el) => {
            sprites.current[i] = el;
          }}
          position={[g.x, g.y, g.z]}
          scale={[0.9, 0.9, 0.9]}
          material={material}
        />
      ))}
    </>
  );
}
