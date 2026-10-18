"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";

import { CAR } from "../logic/car";

export type CarWheels = {
  /** Every wheel (spun by the speed). */
  all: THREE.Object3D[];
  /** The front pair (also steered). */
  front: THREE.Object3D[];
};

/**
 * The curated Kenney sedan (one clone per car). Its wheel nodes are collected so the car
 * system can spin and steer them.
 */
export function CarModel({
  url,
  scale,
  onWheels,
}: {
  url: string;
  scale: number;
  onWheels: (wheels: CarWheels) => void;
}): ReactNode {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  useLayoutEffect(() => {
    const all: THREE.Object3D[] = [];
    const front: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
      if (/^wheel/i.test(o.name)) {
        o.rotation.order = "YXZ";
        all.push(o);
        if (/front/i.test(o.name)) front.push(o);
      }
    });
    onWheels({ all, front });
  }, [scene, onWheels]);
  return <primitive object={scene} scale={scale} />;
}

/** A plain box car while the model loads (or when the manifest is missing). */
export function FallbackCar(): ReactNode {
  return (
    <group>
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[CAR.width, 0.42, CAR.length]} />
        <meshStandardMaterial color="#e2643b" flatShading roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.72, -0.1]} castShadow>
        <boxGeometry args={[CAR.width * 0.8, 0.3, CAR.length * 0.5]} />
        <meshStandardMaterial color="#f0f0ea" flatShading roughness={0.8} />
      </mesh>
    </group>
  );
}
