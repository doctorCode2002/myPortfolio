import * as THREE from "three";

/**
 * Colour grading for KayKit terrain (a fragment patch after the texture lookup):
 * - "terrain": lime/yellow grass texels are pulled towards a softer meadow green
 *   (luminance kept), so the atlas keeps its painted detail without the yellow cast.
 *   Soil and stone texels are left alone, so tile sides still read as earth.
 * - "path": brown dirt texels are pulled towards warm sand.
 * - "road": both (KayKit road tiles are grass with a dirt track).
 */
export type GradeMode = "terrain" | "road" | "path" | "sand" | "foliage";

const PATCHED = "__game3dGrade";

export const GRADE = {
  grass: new THREE.Color("#8abd68"),
  sand: new THREE.Color("#d8b47e"),
  leaf: new THREE.Color("#5f9a46"),
};

const GRASS_MASK =
  "smoothstep(0.02, 0.12, c.g - c.b) * smoothstep(-0.16, 0.0, c.g - c.r)";
const LUM = "vec3(0.2126, 0.7152, 0.0722)";

function gradeBody(mode: GradeMode): string {
  const grassTo = (target: string, lo: number, hi: number): string =>
    `{ float m = ${GRASS_MASK}; float tl = dot(${target}, ${LUM});
       c = mix(c, ${target} * clamp(lum / max(tl, 1e-3), ${lo.toFixed(2)}, ${hi.toFixed(2)}), m * 0.92); }`;
  const dirtToSand = `{ float m = smoothstep(0.02, 0.1, c.r - c.b) * step(c.g, c.r); float tl = dot(uGradeSand, ${LUM});
       c = mix(c, uGradeSand * clamp(lum / max(tl, 1e-3), 0.8, 1.1), m * 0.88); }`;
  switch (mode) {
    case "terrain":
      return grassTo("uGradeGrass", 0.82, 1.06);
    case "road":
      return grassTo("uGradeGrass", 0.82, 1.06) + dirtToSand;
    case "path":
      return dirtToSand;
    case "sand":
      return grassTo("uGradeSand", 0.85, 1.08) + dirtToSand;
    case "foliage":
      // Green-dominant texels (teal crowns included) towards the meadow foliage green;
      // more strongly the bluer they are. Brown trunks (r > g) are left alone.
      return `{ float m = smoothstep(0.0, 0.08, c.g - c.r);
       float teal = smoothstep(0.0, 0.2, c.b - c.r * 0.9);
       float tl = dot(uGradeLeaf, ${LUM});
       c = mix(c, uGradeLeaf * clamp(lum / max(tl, 1e-3), 0.75, 1.2), m * (0.45 + 0.45 * teal)); }`;
  }
}

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
    shader.uniforms.uGradeLeaf = { value: GRADE.leaf.clone() };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uGradeGrass;\nuniform vec3 uGradeSand;\nuniform vec3 uGradeLeaf;"
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          ${gradeBody(mode)}
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
