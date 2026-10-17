"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";

import { useRuntimeRef } from "../runtime";

/** A soft ring where a click/tap-to-move path ends. */
export function TargetMarker(): ReactNode {
  const rtRef = useRuntimeRef();
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const rt = rtRef.current;
    const m = ref.current;
    if (!m) return;
    const t = rt.target;
    m.visible = Boolean(t);
    if (!t) return;
    m.position.set(t.x, t.y + 0.05, t.z);
    const s = rt.reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 6) * 0.08;
    m.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} visible={false} renderOrder={4}>
      <ringGeometry args={[0.22, 0.32, 24]} />
      <meshBasicMaterial
        color="#fff7e0"
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
