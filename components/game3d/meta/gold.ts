/**
 * The golden rewards as material recolours: the car's gold metallic paint and the golden
 * cloak (a KayKit rogue's cape tinted gold). Originals are remembered on the
 * mesh so the tint can be undone; shared source materials are never mutated.
 */

import * as THREE from "three";

const ORIGINAL = "__metaOriginalMaterial";
const GOLD = "__metaGold";

type Tagged = THREE.Mesh & {
  userData: {
    [ORIGINAL]?: THREE.Material | THREE.Material[];
    [GOLD]?: boolean;
  };
};

function goldFrom(
  m: THREE.Material,
  tint: string,
  metalness: number,
  roughness: number,
  emissive: number,
  mode: TintMode
): THREE.Material {
  const src = m as THREE.MeshStandardMaterial;
  const out = new THREE.MeshStandardMaterial({
    map: src.map ?? null,
    color: tint,
    metalness,
    roughness,
    emissive: new THREE.Color("#7a5200"),
    emissiveIntensity: emissive,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
    flatShading: Boolean((src as { flatShading?: boolean }).flatShading),
  });
  out.name = `${m.name}-gold`;
  // Re-colour instead of multiplying: the texture's brightness, painted in the tint, so a
  // red body turns gold too while dark windows and tyres stay dark. "cloth" only repaints
  // the green fabric (a KayKit rogue's hood, cape and tunic) and keeps skin and leather.
  const tc = new THREE.Color(tint);
  out.color.set("#ffffff");
  out.onBeforeCompile = (shader) => {
    shader.uniforms.uGoldTint = { value: tc };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uGoldTint;"
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float goldLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 goldPaint = uGoldTint * clamp(0.45 + goldLum * 1.1, 0.0, 1.3);
        ${
          mode === "cloth"
            ? "float goldMask = smoothstep(0.015, 0.08, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));"
            : "float goldMask = 1.0;"
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, goldPaint, goldMask);`
      )
      .replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor *= goldMask;"
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= goldMask;"
      );
  };
  out.customProgramCacheKey = () => `meta-gold-${mode}`;
  return out;
}

/** "full" repaints every texel gold; "cloth" only the green fabric. */
type TintMode = "full" | "cloth";

function tintMesh(
  mesh: Tagged,
  tint: string,
  metalness: number,
  roughness: number,
  emissive: number,
  mode: TintMode = "full"
): void {
  if (mesh.userData[GOLD]) return;
  mesh.userData[ORIGINAL] = mesh.material;
  mesh.material = Array.isArray(mesh.material)
    ? mesh.material.map((m) =>
        goldFrom(m, tint, metalness, roughness, emissive, mode)
      )
    : goldFrom(mesh.material, tint, metalness, roughness, emissive, mode);
  mesh.userData[GOLD] = true;
}

function untintMesh(mesh: Tagged): void {
  if (!mesh.userData[GOLD]) return;
  const orig = mesh.userData[ORIGINAL];
  const gold = mesh.material;
  if (orig) mesh.material = orig;
  for (const m of Array.isArray(gold) ? gold : [gold]) m.dispose();
  delete mesh.userData[ORIGINAL];
  mesh.userData[GOLD] = false;
}

/** Gold metallic car paint (windows and wheels included: it is a trophy car). */
export function setGoldPaint(root: THREE.Object3D, on: boolean): void {
  root.traverse((o) => {
    const mesh = o as Tagged;
    if (!mesh.isMesh) return;
    if (on) tintMesh(mesh, "#ffc83d", 0.3, 0.32, 0.35);
    else untintMesh(mesh);
  });
}

/** Meshes that make up a character's cloak (KayKit names its cape node). */
const CLOAK = /cape|cloak/i;

/**
 * The golden cloak: the cape, hood and green cloth in gold (skin, hair and leather keep
 * their colours). True when the model has a cloak to tint.
 */
export function setGoldCloak(root: THREE.Object3D, on: boolean): boolean {
  let found = false;
  root.traverse((o) => {
    const mesh = o as Tagged;
    if (!mesh.isMesh) return;
    const cloak = CLOAK.test(mesh.name) || CLOAK.test(mesh.parent?.name ?? "");
    if (cloak) found = true;
    if (!on) untintMesh(mesh);
    else tintMesh(mesh, "#ffc83d", 0.3, 0.35, 0.3, cloak ? "full" : "cloth");
  });
  return found;
}
