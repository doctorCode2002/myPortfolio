import * as THREE from "three";

import { sharedUniforms } from "./shared-time";

const PATCHED = "__game3dWind";

/**
 * Wind sway for foliage: a vertex patch (onBeforeCompile) that bends vertices by their
 * height above the model's base, phase-shifted by world position so neighbouring trees
 * move out of step. Works with instanced meshes. Off when uMotion is 0.
 */
export function patchFoliage<T extends THREE.Material>(
  material: T,
  strength = 1
): T {
  const m = material as T & { [PATCHED]?: boolean };
  if (m[PATCHED]) return material;
  m[PATCHED] = true;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uMotion = sharedUniforms.uMotion;
    shader.uniforms.uWind = { value: 0.045 * strength };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uMotion;\nuniform float uWind;"
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec4 windBase = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            windBase = instanceMatrix * windBase;
          #endif
          windBase = modelMatrix * windBase;
          float windH = max(position.y, 0.0);
          float windW = sin(uTime * 1.7 + windBase.x * 0.6 + windBase.z * 0.45)
                      + 0.4 * sin(uTime * 3.1 + windBase.z * 1.3);
          transformed.x += windW * uWind * windH * windH * uMotion;
          transformed.z += windW * uWind * 0.6 * windH * windH * uMotion;
        }`
      );
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ""}|wind${strength}`;
  material.needsUpdate = true;
  return material;
}
