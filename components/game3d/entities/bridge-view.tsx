"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { buildBridgeBoxes } from "../logic/bridge-layout";
import type { BridgeCorridor } from "../logic/walk-world";
import { islandBob, useRuntimeRef } from "../runtime";

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler(0, 0, 0, "YXZ");
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();

/**
 * A generated bridge: one instanced box mesh (planks, stringers, posts and rails, or
 * stone blocks and parapets). Each instance blends the two islands' bob by its position
 * along the span (aT), so the deck stays attached while the islands float.
 */
export function BridgeView({
  bridge,
  hexWidth,
}: {
  bridge: BridgeCorridor;
  hexWidth: number;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const ref = useRef<THREE.InstancedMesh>(null);
  const boxes = useMemo(
    () => buildBridgeBoxes(bridge, hexWidth),
    [bridge, hexWidth]
  );
  const uniforms = useRef({ uBobA: { value: 0 }, uBobB: { value: 0 } });
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.setAttribute(
      "aT",
      new THREE.InstancedBufferAttribute(
        new Float32Array(boxes.map((b) => b.t)),
        1
      )
    );
    return g;
  }, [boxes]);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      flatShading: true,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uBobA = uniforms.current.uBobA;
      shader.uniforms.uBobB = uniforms.current.uBobB;
      // Bob after the instance transform: expand project_vertex with a y offset in model space.
      const project = THREE.ShaderChunk.project_vertex.replace(
        "mvPosition = modelViewMatrix * mvPosition;",
        "mvPosition.y += mix(uBobA, uBobB, aT);\nmvPosition = modelViewMatrix * mvPosition;"
      );
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float aT;\nuniform float uBobA;\nuniform float uBobB;"
        )
        .replace("#include <project_vertex>", project);
    };
    m.customProgramCacheKey = () => "game3d-bridge";
    return m;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    boxes.forEach((b, i) => {
      tmpP.set(b.x, b.y, b.z);
      tmpE.set(b.pitch, b.yaw, 0, "YXZ");
      tmpQ.setFromEuler(tmpE);
      tmpS.set(b.sx, b.sy, b.sz);
      mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      mesh.setColorAt(
        i,
        tmpC.setRGB(b.color[0], b.color[1], b.color[2], THREE.SRGBColorSpace)
      );
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);

  useFrame(({ clock }) => {
    const rt = rtRef.current;
    uniforms.current.uBobA.value = islandBob(
      bridge.from,
      clock.elapsedTime,
      rt.reducedMotion
    );
    uniforms.current.uBobB.value = islandBob(
      bridge.to,
      clock.elapsedTime,
      rt.reducedMotion
    );
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, boxes.length]}
      castShadow
      receiveShadow
      name={`bridge-${bridge.id}`}
    />
  );
}
