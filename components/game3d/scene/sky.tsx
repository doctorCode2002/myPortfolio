"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

/** Sunset palette, shared with the fog so the horizon melts into the sky. */
export const SKY = {
  zenith: "#1d3766",
  upper: "#4a72a8",
  horizonSun: "#f8b487",
  horizonAway: "#b9a7d0",
  sunGlow: "#ff9a62",
  haze: "#c7b3c6",
  deep: "#6c82b3",
  cloud: "#f6e6e3",
  sunColor: "#ffd2a0",
  /** Fog matches the haze just below the horizon so distant islands fade into it. */
  fog: "#c7b3c6",
};

/** Direction towards the sun (normalised): low behind the camera's right shoulder. */
export const SUN_DIR = new THREE.Vector3(-0.56, 0.46, 0.69).normalize();

const col = (hex: string): THREE.Color => new THREE.Color(hex);

/**
 * Gradient sunset dome: deep blue zenith, peach-orange horizon glow around the sun,
 * soft lavender opposite, and below the horizon a haze with drifting soft clouds
 * fading into blue depth. Follows the camera.
 */
export function SkyDome({
  reducedMotion,
}: {
  reducedMotion: boolean;
}): ReactNode {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uZenith: { value: col(SKY.zenith) },
    uUpper: { value: col(SKY.upper) },
    uHorSun: { value: col(SKY.horizonSun) },
    uHorAway: { value: col(SKY.horizonAway) },
    uSunGlow: { value: col(SKY.sunGlow) },
    uHaze: { value: col(SKY.haze) },
    uDeep: { value: col(SKY.deep) },
    uCloud: { value: col(SKY.cloud) },
    uSunDir: { value: SUN_DIR.clone() },
    uTime: { value: 0 },
  }), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uZenith; uniform vec3 uUpper; uniform vec3 uHorSun; uniform vec3 uHorAway;
          uniform vec3 uSunGlow; uniform vec3 uHaze; uniform vec3 uDeep; uniform vec3 uCloud;
          uniform vec3 uSunDir; uniform float uTime;
          varying vec3 vDir;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float vnoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
          }
          float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
            return v;
          }
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec2 flat2 = normalize(d.xz + 1e-5);
            float toward = clamp(dot(flat2, normalize(uSunDir.xz)) * 0.5 + 0.5, 0.0, 1.0);
            vec3 horizon = mix(uHorAway, uHorSun, pow(toward, 1.6));
            float sunDot = max(dot(d, uSunDir), 0.0);
            vec3 col;
            if (h >= 0.0) {
              col = mix(horizon, uUpper, smoothstep(0.02, 0.32, h));
              col = mix(col, uZenith, smoothstep(0.3, 0.95, h));
            } else {
              col = mix(horizon, uHaze, smoothstep(0.0, -0.12, h));
              col = mix(col, uDeep, smoothstep(-0.2, -0.95, h));
              // A soft cloud sea below the islands, projected onto a plane.
              vec2 uv = d.xz / (-h + 0.18) * 1.6 + vec2(uTime * 0.01, uTime * 0.004);
              float c = smoothstep(0.48, 0.78, fbm(uv));
              float fade = smoothstep(-0.03, -0.25, h) * (1.0 - smoothstep(-0.55, -0.95, h));
              col = mix(col, mix(uCloud, horizon, 0.35), c * fade * 0.6);
            }
            col += uSunGlow * pow(sunDot, 6.0) * 0.35 * (1.0 - smoothstep(0.0, 0.5, abs(h)));
            col += vec3(1.0, 0.93, 0.8) * (pow(sunDot, 600.0) * 1.2 + pow(sunDot, 60.0) * 0.18);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [uniforms]
  );
  useFrame(({ camera, clock }) => {
    mesh.current?.position.copy(camera.position);
    const mat = mesh.current?.material as THREE.ShaderMaterial | undefined;
    const time = mat?.uniforms.uTime;
    if (time && !reducedMotion) time.value = clock.elapsedTime;
  });
  return (
    <mesh
      ref={mesh}
      material={material}
      renderOrder={-10}
      frustumCulled={false}
    >
      <sphereGeometry args={[400, 48, 24]} />
    </mesh>
  );
}
