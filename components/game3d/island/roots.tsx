"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import type { RootSegment } from "../logic/underside";

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** Hanging roots under the island rim: tapered 5-sided segments, one instanced mesh. */
export function Roots({
  segments,
}: {
  segments: readonly RootSegment[];
}): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(
    () => new THREE.CylinderGeometry(0.7, 1, 1, 5, 1),
    []
  );
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#5a4128",
        roughness: 1,
        flatShading: true,
      }),
    []
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    segments.forEach((s, i) => {
      const a = new THREE.Vector3(...s.a);
      const b = new THREE.Vector3(...s.b);
      const dir = b.clone().sub(a);
      const len = dir.length();
      tmpP.copy(a).add(b).multiplyScalar(0.5);
      tmpQ.setFromUnitVectors(Y, dir.normalize());
      tmpS.set(s.radius, len, s.radius);
      mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [segments]);
  if (segments.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, material, segments.length]} />
  );
}
