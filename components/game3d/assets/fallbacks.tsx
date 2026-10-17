"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { patchFoliage } from "../fx/wind";
import type { ObjectKind } from "../logic/catalog";
import type { InstanceTransform } from "./instanced-model";

/**
 * Procedural stand-ins for models the manifest does not (yet) list: hex prisms for tiles,
 * box-and-roof houses, cone trees, rocks and crates. Instanced with per-instance colours.
 */

export type ColoredInstance = InstanceTransform & {
  color: string;
  sy?: number;
};

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function ColoredInstances({
  geometry,
  material,
  items,
  castShadow = true,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: readonly ColoredInstance[];
  castShadow?: boolean;
}): ReactNode {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      tmpP.set(it.x, it.y, it.z);
      tmpQ.setFromAxisAngle(UP, it.rotY);
      tmpS.set(it.scale, it.scale * (it.sy ?? 1), it.scale);
      mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      mesh.setColorAt(i, tmpC.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}

/** Pointy-top hex prism, 1 m thick, top at y = 0 (matches the KayKit tiles). */
export function hexPrismGeometry(size: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(size, size, 1, 6, 1);
  g.translate(0, -0.5, 0);
  return g;
}

export const TILE_COLORS: Record<string, string> = {
  grass: "#7fb069",
  water: "#4f8fb0",
  road: "#c9a66b",
  sand: "#e3c98f",
  stone: "#a8a39a",
  default: "#8cb36d",
};

export function tileColor(name: string): string {
  if (/water|river|pond/i.test(name)) return TILE_COLORS.water as string;
  if (/road|path|dirt/i.test(name)) return TILE_COLORS.road as string;
  if (/sand|coast|beach/i.test(name)) return TILE_COLORS.sand as string;
  if (/stone|rock/i.test(name)) return TILE_COLORS.stone as string;
  return TILE_COLORS.grass as string;
}

export function FallbackTiles({
  items,
  size,
}: {
  items: readonly ColoredInstance[];
  size: number;
}): ReactNode {
  const geometry = useMemo(() => hexPrismGeometry(size * 0.995), [size]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
    []
  );
  return (
    <ColoredInstances
      geometry={geometry}
      material={material}
      items={items}
      castShadow={false}
    />
  );
}

function houseGeometry(): THREE.BufferGeometry[] {
  const body = new THREE.BoxGeometry(1.3, 1, 1.2);
  body.translate(0, 0.5, 0);
  const roof = new THREE.ConeGeometry(1.05, 0.8, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, 1.4, 0);
  return [body, roof];
}

/** Stand-ins for objects, grouped by kind. */
export function FallbackObjects({
  items,
}: {
  items: readonly (ColoredInstance & { kind: ObjectKind })[];
}): ReactNode {
  const geo = useMemo(() => {
    const [body, roof] = houseGeometry();
    const trunk = new THREE.CylinderGeometry(0.08, 0.12, 0.6, 5);
    trunk.translate(0, 0.3, 0);
    const crown = new THREE.ConeGeometry(0.55, 1.4, 6);
    crown.translate(0, 1.2, 0);
    const rock = new THREE.DodecahedronGeometry(0.4, 0);
    rock.translate(0, 0.2, 0);
    const crate = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    crate.translate(0, 0.225, 0);
    const flat = new THREE.CylinderGeometry(0.9, 0.9, 0.04, 6);
    flat.translate(0, 0.02, 0);
    return { body, roof, trunk, crown, rock, crate, flat } as Record<
      string,
      THREE.BufferGeometry
    >;
  }, []);
  const mats = useMemo(() => {
    const plain = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      flatShading: true,
    });
    const leaves = patchFoliage(
      new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true })
    );
    return { plain, leaves };
  }, []);
  const by = (k: ObjectKind): (ColoredInstance & { kind: ObjectKind })[] =>
    items.filter((i) => i.kind === k);
  const buildings = by("building");
  const trees = by("tree");
  const roofs = buildings.map((b) => ({ ...b, color: "#b5523b" }));
  const walls = buildings.map((b) => ({ ...b, color: "#efe2c8" }));
  const trunks = trees.map((t) => ({ ...t, color: "#7a5532" }));
  return (
    <>
      <ColoredInstances
        geometry={geo.body as THREE.BufferGeometry}
        material={mats.plain}
        items={walls}
      />
      <ColoredInstances
        geometry={geo.roof as THREE.BufferGeometry}
        material={mats.plain}
        items={roofs}
      />
      <ColoredInstances
        geometry={geo.trunk as THREE.BufferGeometry}
        material={mats.leaves}
        items={trunks}
      />
      <ColoredInstances
        geometry={geo.crown as THREE.BufferGeometry}
        material={mats.leaves}
        items={trees}
      />
      <ColoredInstances
        geometry={geo.rock as THREE.BufferGeometry}
        material={mats.plain}
        items={by("rock")}
      />
      <ColoredInstances
        geometry={geo.crate as THREE.BufferGeometry}
        material={mats.plain}
        items={by("prop")}
      />
      <ColoredInstances
        geometry={geo.flat as THREE.BufferGeometry}
        material={mats.plain}
        items={by("flat")}
        castShadow={false}
      />
    </>
  );
}

export const FALLBACK_COLORS: Record<ObjectKind, string> = {
  building: "#efe2c8",
  tree: "#4f8a3c",
  rock: "#9a948a",
  prop: "#a8754a",
  flat: "#c9a66b",
};
