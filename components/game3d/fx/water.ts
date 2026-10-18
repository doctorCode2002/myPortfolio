import * as THREE from "three";

import { sharedUniforms } from "./shared-time";

/**
 * Pond water: a lit, slightly transparent standard material with a gentle vertex wave,
 * drifting ripple bands and foam where the water meets land (the `aFoam` attribute is 1
 * at rim vertices that touch a non-water neighbour).
 */
export function createWaterMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: "#5cc2b8",
    roughness: 0.15,
    metalness: 0,
    transparent: true,
    opacity: 0.88,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uMotion = sharedUniforms.uMotion;
    shader.uniforms.uRain = sharedUniforms.uRain;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uMotion;\nattribute float aFoam;\nvarying float vFoam;\nvarying vec2 vWaterXZ;"
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vFoam = aFoam;
        vec4 wWorld = modelMatrix * vec4(position, 1.0);
        vWaterXZ = wWorld.xz;
        transformed.y += sin(uTime * 1.3 + wWorld.x * 1.7 + wWorld.z * 1.1) * 0.02 * uMotion * (1.0 - aFoam);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uMotion;\nuniform float uRain;\nvarying float vFoam;\nvarying vec2 vWaterXZ;"
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float t = uTime * uMotion;
          float ripple = sin(vWaterXZ.x * 3.1 + t * 1.4) * sin(vWaterXZ.y * 2.7 - t * 1.1);
          float bands = smoothstep(0.55, 0.95, ripple);
          vec3 deep = vec3(0.03, 0.29, 0.33);
          vec3 shallow = vec3(0.22, 0.66, 0.6);
          diffuseColor.rgb = mix(deep, shallow, 0.35 + 0.35 * vFoam) + bands * 0.12;
          float foamNoise = 0.5 + 0.5 * sin(vWaterXZ.x * 9.0 + t * 2.0) * sin(vWaterXZ.y * 8.0 - t * 1.6);
          float foam = smoothstep(0.62, 0.95, vFoam + foamNoise * 0.18);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 0.98), foam);
          diffuseColor.a = mix(diffuseColor.a, 1.0, foam);
          // Rain: expanding rings from drops on a jittered grid.
          if (uRain > 0.01) {
            vec2 g = vWaterXZ * 2.2;
            vec2 id = floor(g);
            vec2 f = fract(g) - 0.5;
            float h = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
            vec2 o = vec2(fract(h * 7.13), fract(h * 3.71)) - 0.5;
            float life = fract(t * 0.9 + h);
            float d = length(f - o * 0.5);
            float ring = smoothstep(0.05, 0.0, abs(d - life * 0.45)) * (1.0 - life);
            diffuseColor.rgb += vec3(0.75, 0.85, 0.9) * ring * uRain * 0.55;
          }
        }`
      );
  };
  mat.customProgramCacheKey = () => "game3d-water";
  return mat;
}

/** Waterfall ribbon: unlit, scrolling streaks along the fall (uv.y), fading at the bottom. */
export function createWaterfallMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: "#cfeefa",
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uMotion = sharedUniforms.uMotion;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vFallUv;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFallUv = uv;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uMotion;\nvarying vec2 vFallUv;"
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float t = uTime * uMotion;
          float streak = sin(vFallUv.x * 31.0 + sin(vFallUv.x * 7.0) * 2.0) * 0.5 + 0.5;
          float flow = fract(vFallUv.y * 3.0 - t * 1.2 + streak * 0.35);
          float bright = smoothstep(0.0, 0.25, flow) * (1.0 - smoothstep(0.55, 1.0, flow));
          float edge = smoothstep(0.0, 0.18, vFallUv.x) * smoothstep(1.0, 0.82, vFallUv.x);
          float fade = 1.0 - smoothstep(0.6, 1.0, vFallUv.y);
          diffuseColor.rgb = mix(vec3(0.55, 0.8, 0.92), vec3(0.97, 0.99, 1.0), bright * 0.8 + streak * 0.2);
          diffuseColor.a = (0.45 + 0.4 * bright) * edge * fade;
        }`
      );
  };
  mat.customProgramCacheKey = () => "game3d-waterfall";
  return mat;
}
