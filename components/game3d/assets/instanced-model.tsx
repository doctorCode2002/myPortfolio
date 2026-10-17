"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import type { GradeMode } from "../fx/grade";
import { collectMeshParts, type MeshPart } from "./prepare";

export type InstanceTransform = {
  x: number;
  y: number;
  z: number;
  /** Radians around +y. */
  rotY: number;
  scale: number;
  /** Optional per-instance colour multiplier (linear rgb, around 1). */
  tint?: readonly [number, number, number];
};

/**
 * Draws every placement of one static glTF model with a single InstancedMesh per mesh
 * part (one draw call per part regardless of how many copies), so repeated tiles, trees
 * and props stay cheap.
 */
export function InstancedModel({
  url,
  items,
  foliage = false,
  grade = null,
  castShadow = true,
  receiveShadow = true,
}: {
  url: string;
  items: readonly InstanceTransform[];
  foliage?: boolean;
  grade?: GradeMode | null;
  castShadow?: boolean;
  receiveShadow?: boolean;
}): ReactNode {
  const gltf = useGLTF(url);
  const parts = useMemo(
    () => collectMeshParts(gltf.scene, foliage, grade),
    [gltf.scene, foliage, grade]
  );
  if (items.length === 0) return null;
  return (
    <>
      {parts.map((part, i) => (
        <InstancedPart
          key={i}
          part={part}
          items={items}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        />
      ))}
    </>
  );
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmpC = new THREE.Color();

function InstancedPart({
  part,
  items,
  castShadow,
  receiveShadow,
}: {
  part: MeshPart;
  items: readonly InstanceTransform[];
  castShadow: boolean;
  receiveShadow: boolean;
}): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      tmpP.set(it.x, it.y, it.z);
      tmpQ.setFromAxisAngle(UP, it.rotY);
      tmpS.setScalar(it.scale);
      tmpM.compose(tmpP, tmpQ, tmpS).multiply(part.matrix);
      mesh.setMatrixAt(i, tmpM);
      if (it.tint)
        mesh.setColorAt(i, tmpC.setRGB(it.tint[0], it.tint[1], it.tint[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [items, part]);
  return (
    <instancedMesh
      ref={ref}
      args={[part.geometry, part.material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}
