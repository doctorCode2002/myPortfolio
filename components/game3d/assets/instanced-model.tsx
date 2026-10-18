"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import type { GradeMode } from "../fx/grade";
import { propScale, touchedKeys } from "../logic/breakables";
import { useOptionalRuntimeRef } from "../runtime";
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
  /** Island object key: breakable props hide while broken and scale back up on regrow. */
  key?: string;
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

function writeMatrix(
  mesh: THREE.InstancedMesh,
  i: number,
  it: InstanceTransform,
  part: MeshPart,
  k: number
): void {
  tmpP.set(it.x, it.y, it.z);
  tmpQ.setFromAxisAngle(UP, it.rotY);
  // Scaled about the object origin (its ground point), so props regrow from the ground.
  tmpS.setScalar(Math.max(it.scale * k, 1e-5));
  tmpM.compose(tmpP, tmpQ, tmpS).multiply(part.matrix);
  mesh.setMatrixAt(i, tmpM);
}

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
  const rtRef = useOptionalRuntimeRef();
  const keyIndex = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it, i) => {
      if (it.key) m.set(it.key, i);
    });
    return m;
  }, [items]);
  const seen = useRef({ version: -1, dirty: new Set<number>() });
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      writeMatrix(mesh, i, it, part, 1);
      if (it.tint)
        mesh.setColorAt(i, tmpC.setRGB(it.tint[0], it.tint[1], it.tint[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    seen.current = { version: -1, dirty: new Set() };
  }, [items, part]);

  // Broken props: zero scale while broken, an eased scale-up while they regrow. Only the
  // touched instances are rewritten, and only when the break store changed.
  useFrame(() => {
    const mesh = ref.current;
    const store = rtRef?.current.props;
    if (!mesh || !store || keyIndex.size === 0) return;
    if (store.version === seen.current.version) return;
    seen.current.version = store.version;
    const now = performance.now();
    const next = new Set<number>();
    for (const key of touchedKeys(store)) {
      const i = keyIndex.get(key);
      if (i !== undefined) next.add(i);
    }
    const prev = seen.current.dirty;
    if (next.size === 0 && prev.size === 0) return;
    for (const i of new Set([...prev, ...next])) {
      const it = items[i];
      if (!it?.key) continue;
      writeMatrix(mesh, i, it, part, propScale(store, it.key, now));
    }
    seen.current.dirty = next;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[part.geometry, part.material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}
