"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

/** Sunset palette, shared with the fog so the horizon melts into the sky. */
export const SKY = {
  zenith: "#3d6d99",
  mid: "#86aecb",
  horizon: "#f1c9a0",
  /** Looking down past the islands: a hazy blue depth under the sunset band. */
  below: "#7d9fc4",
  deep: "#56739f",
  sunColor: "#fff0dc",
  fog: "#c9c3c4",
};

/** Direction towards the sun (normalised), low in the south-west for long soft shadows. */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();

/** A gradient sky dome with a soft sun glow; it follows the camera so it never clips. */
export function SkyDome(): ReactNode {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color(SKY.zenith) },
          uMid: { value: new THREE.Color(SKY.mid) },
          uHorizon: { value: new THREE.Color(SKY.horizon) },
          uBelow: { value: new THREE.Color(SKY.below) },
          uDeep: { value: new THREE.Color(SKY.deep) },
          uSun: { value: new THREE.Color(SKY.sunColor) },
          uSunDir: { value: SUN_DIR.clone() },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uBelow; uniform vec3 uDeep;
          uniform vec3 uSun; uniform vec3 uSunDir;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 col = h > 0.0
              ? mix(mix(uHorizon, uMid, smoothstep(0.0, 0.25, h)), uZenith, smoothstep(0.25, 0.85, h))
              : mix(mix(uHorizon, uBelow, smoothstep(0.0, -0.22, h)), uDeep, smoothstep(-0.22, -0.9, h));
            float s = max(dot(normalize(vDir), uSunDir), 0.0);
            col += uSun * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 0.9);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    []
  );
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
  });
  return (
    <mesh
      ref={mesh}
      material={material}
      renderOrder={-10}
      frustumCulled={false}
    >
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}
