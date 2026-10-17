"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { useRuntimeRef } from "../runtime";
import { SKY, SUN_DIR } from "./sky";

/**
 * Sun (directional, PCF soft shadows from a tight shadow camera that follows the player),
 * a hemisphere fill and a touch of ambient.
 */
export function Lights({
  shadowMapSize,
}: {
  shadowMapSize: number;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const sun = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -18;
    cam.right = 18;
    cam.top = 18;
    cam.bottom = -18;
    cam.near = 1;
    cam.far = 120;
    cam.updateProjectionMatrix();
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.03;
    light.shadow.radius = 4;
    light.shadow.blurSamples = 12;
  }, []);

  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
  }, [shadowMapSize]);

  useFrame(() => {
    const rt = rtRef.current;
    const light = sun.current;
    if (!light) return;
    const p = rt.player.pos;
    // Snap to shadow texels to avoid shimmering while walking.
    const texel = 36 / shadowMapSize;
    const x = Math.round(p.x / texel) * texel;
    const z = Math.round(p.z / texel) * texel;
    light.target.position.set(x, p.y, z);
    light.position.set(
      x + SUN_DIR.x * 55,
      p.y + SUN_DIR.y * 55,
      z + SUN_DIR.z * 55
    );
    light.target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={["#a9c8ec", "#c08d63", 1.05]} />
      <ambientLight intensity={0.12} color="#f3c9b0" />
      <directionalLight
        ref={sun}
        color={SKY.sunColor}
        intensity={2.3}
        castShadow
      />
    </>
  );
}
