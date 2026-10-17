import * as THREE from "three";

/**
 * Colour grading for KayKit terrain (a fragment patch after the texture lookup):
 * - "terrain": lime/yellow grass texels are pulled towards a softer meadow green
 *   (luminance kept), so the atlas keeps its painted detail without the yellow cast.
 *   Soil and stone texels are left alone, so tile sides still read as earth.
 * - "path": brown dirt texels are pulled towards warm sand.
 * - "road": both (KayKit road tiles are grass with a dirt track).
 */
export type GradeMode = "terrain" | "road" | "path";

const PATCHED = "__game3dGrade";

export const GRADE = {
  grass: new THREE.Color("#8abd68"),
  sand: new THREE.Color("#d8b47e"),
};

export function patchGrade<T extends THREE.Material>(
  material: T,
  mode: GradeMode
): T {
  const m = material as T & { [PATCHED]?: GradeMode };
  if (m[PATCHED]) return material;
  m[PATCHED] = mode;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uGradeGrass = { value: GRADE.grass.clone() };
    shader.uniforms.uGradeSand = { value: GRADE.sand.clone() };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uGradeGrass;\nuniform vec3 uGradeSand;"
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          ${
            mode !== "path"
              ? `float grassMask = smoothstep(0.02, 0.12, c.g - c.b) * smoothstep(-0.16, 0.0, c.g - c.r);
          float grassLum = dot(uGradeGrass, vec3(0.2126, 0.7152, 0.0722));
          c = mix(c, uGradeGrass * clamp(lum / max(grassLum, 1e-3), 0.82, 1.06), grassMask * 0.92);`
              : ""
          }
          ${
            mode !== "terrain"
              ? `float dirtMask = smoothstep(0.02, 0.1, c.r - c.b) * step(c.g, c.r);
          float sandLum = dot(uGradeSand, vec3(0.2126, 0.7152, 0.0722));
          c = mix(c, uGradeSand * clamp(lum / max(sandLum, 1e-3), 0.8, 1.1), dirtMask * 0.88);`
              : ""
          }
          diffuseColor.rgb = c;
        }`
      );
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ""}|grade-${mode}`;
  material.needsUpdate = true;
  return material;
}
