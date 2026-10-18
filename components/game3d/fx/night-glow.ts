import * as THREE from "three";

import { sharedUniforms } from "./shared-time";

const PATCHED = "__game3dNight";

/**
 * Atlas cells (column, row of an 8 x 4 grid, row 0 at the top) that hold the window
 * panes of the KayKit medieval buildings' shared palette texture.
 */
export const KAYKIT_WINDOW_CELLS: readonly (readonly [number, number])[] = [
  [6, 1],
];

const GLOW_NAME = /glass|glow|window|crystal|lamp/i;

/** Whether a loaded material gets the night glow, and how. */
export function nightGlowFor(
  material: THREE.Material
): { cells: readonly (readonly [number, number])[] | null } | null {
  if (GLOW_NAME.test(material.name)) return { cells: null };
  if (/hexagons_medieval/i.test(material.name))
    return { cells: KAYKIT_WINDOW_CELLS };
  return null;
}

/**
 * Night glow: emissive light that rises with the shared `uNight` uniform. Whole
 * materials (named glass / glow / crystal) glow in their own colour; atlas materials glow
 * only in the given texture cells (the window panes). No extra draw calls.
 */
export function patchNightGlow<T extends THREE.Material>(
  material: T,
  cells: readonly (readonly [number, number])[] | null,
  strength = 1
): T {
  const m = material as T & { [PATCHED]?: boolean };
  if (m[PATCHED]) return material;
  m[PATCHED] = true;
  const prev = material.onBeforeCompile;
  const mask = cells
    ? `float nightMask = 0.0;
       {
         vec2 nc = floor(vMapUv * vec2(8.0, 4.0));
         ${cells
           .map(
             ([c, r]) =>
               `nightMask = max(nightMask, step(abs(nc.x - ${c.toFixed(1)}) + abs(nc.y - ${r.toFixed(1)}), 0.5));`
           )
           .join("\n")}
       }`
    : "float nightMask = 1.0;";
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uNight = sharedUniforms.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          ${cells ? "#ifdef USE_MAP" : ""}
          ${mask}
          vec3 warm = mix(vec3(1.0, 0.72, 0.38), diffuseColor.rgb, ${cells ? "0.15" : "0.55"});
          totalEmissiveRadiance += warm * nightMask * uNight * ${strength.toFixed(2)};
          ${cells ? "#endif" : ""}
        }`
      );
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ""}|night${cells ? cells.join(";") : "all"}${strength}`;
  material.needsUpdate = true;
  return material;
}
