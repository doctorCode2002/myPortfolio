"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import { pickClips } from "../assets/characters";
import { allowedModel, modelUrl } from "../assets/manifest";
import type { Manifest } from "../logic/types";

export type AnimState = { anim: "idle" | "walk" | "run"; speed: number };

/** Hand-held items are stripped by the curator; hide any that slip through (no crossguards). */
const HELD_ITEM =
  /sword|axe|knife|dagger|crossbow|shield|staff|wand|spellbook|mug|throwable|bow$/i;

/** Placeholder capsule (with a nose so the facing reads) while loading or without a model. */
export function CapsuleCharacter({ color }: { color: string }): ReactNode {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.5, 4, 10]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.66, 0.18]} castShadow>
        <boxGeometry args={[0.12, 0.08, 0.12]} />
        <meshStandardMaterial color="#f3e2c6" />
      </mesh>
    </group>
  );
}

class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(err: unknown): void {
    console.warn(
      "[game3d] character model failed to load, using the placeholder",
      err
    );
  }
  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SkinnedCharacter({
  url,
  scale,
  state,
}: {
  url: string;
  scale: number;
  state: RefObject<AnimState>;
}): ReactNode {
  const gltf = useGLTF(url);
  const root = useRef<THREE.Group>(null);
  const scene = useMemo(() => {
    const c = cloneSkinned(gltf.scene);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (HELD_ITEM.test(o.name) && !(o as THREE.Bone).isBone)
        o.visible = false;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        const convert = (m: THREE.Material): THREE.Material =>
          m instanceof THREE.MeshBasicMaterial
            ? new THREE.MeshLambertMaterial({
                color: m.color,
                map: m.map,
                transparent: m.transparent,
              })
            : m;
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(convert)
          : convert(mesh.material);
      }
    });
    return c;
  }, [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, root);
  const clips = useMemo(() => pickClips(names), [names]);
  const current = useRef<string | null>(null);

  useEffect(() => {
    current.current = null;
  }, [actions]);

  useFrame(() => {
    const want = state.current?.anim ?? "idle";
    const name = clips[want] ?? clips.walk ?? clips.idle;
    if (!name) return;
    if (name !== current.current) {
      const prev = current.current ? actions[current.current] : null;
      const next = actions[name];
      if (next) {
        next.reset().setEffectiveWeight(1).fadeIn(0.22).play();
        prev?.fadeOut(0.22);
        current.current = name;
      }
    }
    const action = actions[name];
    if (action) {
      const speed = state.current?.speed ?? 0;
      action.setEffectiveTimeScale(
        want === "walk"
          ? THREE.MathUtils.clamp(speed / 1.9, 0.6, 1.4)
          : want === "run"
            ? THREE.MathUtils.clamp(speed / 4.2, 0.7, 1.3)
            : 1
      );
    }
  });

  return (
    <group ref={root}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

/** An animated KayKit/Kenney character from the manifest, or the capsule placeholder. */
export function CharacterModel({
  manifest,
  name,
  color,
  state,
}: {
  manifest: Manifest | null;
  name: string | null;
  color: string;
  state: RefObject<AnimState>;
}): ReactNode {
  const url = name ? modelUrl(manifest, name) : null;
  const scale = name ? (allowedModel(manifest, name)?.scale ?? 1) : 1;
  const capsule = <CapsuleCharacter color={color} />;
  if (!url) return capsule;
  return (
    <ModelErrorBoundary key={url} fallback={capsule}>
      <Suspense fallback={capsule}>
        <SkinnedCharacter url={url} scale={scale} state={state} />
      </Suspense>
    </ModelErrorBoundary>
  );
}
