import * as THREE from "three";

import { patchFoliage } from "../fx/wind";

/**
 * Normalise a loaded material for the world: unlit (KHR_materials_unlit) materials become
 * Lambert so they take the sun, hemisphere light and shadows like everything else;
 * foliage materials get the wind patch. Returns a new material (the cache stays intact).
 */
export function prepareMaterial(
  src: THREE.Material,
  foliage: boolean
): THREE.Material {
  let mat: THREE.Material;
  if (src instanceof THREE.MeshBasicMaterial) {
    const lambert = new THREE.MeshLambertMaterial({
      color: src.color,
      map: src.map,
      vertexColors: src.vertexColors,
      transparent: src.transparent,
      opacity: src.opacity,
      alphaTest: src.alphaTest,
      side: src.side,
    });
    lambert.name = src.name;
    mat = lambert;
  } else {
    mat = src.clone();
  }
  // Patch every material of a foliage model (trunk included) so the crown never detaches.
  if (foliage) patchFoliage(mat);
  return mat;
}

export type MeshPart = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  /** Transform of the mesh relative to the model root. */
  matrix: THREE.Matrix4;
};

/** Flatten a static model (no skinning) into mesh parts with root-relative matrices. */
export function collectMeshParts(
  root: THREE.Object3D,
  foliage: boolean
): MeshPart[] {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts: MeshPart[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || (obj as THREE.SkinnedMesh).isSkinnedMesh) return;
    const material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => prepareMaterial(m, foliage))
      : prepareMaterial(mesh.material, foliage);
    parts.push({
      geometry: mesh.geometry,
      material,
      matrix: new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld),
    });
  });
  return parts;
}
