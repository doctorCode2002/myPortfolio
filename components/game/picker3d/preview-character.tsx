"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import {
  CHARACTER_COLORS,
  pickClips,
} from "@/components/game3d/assets/characters";
import { CapsuleCharacter } from "@/components/game3d/entities/character-model";
import { SKY, SUN_DIR } from "@/components/game3d/scene/sky";
import type { PreviewModel } from "./use-picker-manifest";

/** Hand-held items are stripped by the curator; hide any that slip through (no crossguards). */
const HELD_ITEM =
  /sword|axe|knife|dagger|crossbow|shield|staff|wand|spellbook|mug|throwable|bow$/i;

/** Soft warm light matching the world's sunset (hemisphere fill, a low peach key from the front-right). */
export function PreviewLights(): ReactNode {
  return (
    <>
      <hemisphereLight args={["#a9c8ec", "#c08d63", 1.15]} />
      <ambientLight intensity={0.2} color="#f3c9b0" />
      <directionalLight
        color={SKY.sunColor}
        intensity={2.1}
        position={[-SUN_DIR.x * 4, SUN_DIR.y * 4 + 1, SUN_DIR.z * 4]}
      />
      <directionalLight
        color="#b9a7d0"
        intensity={0.55}
        position={[3, 2, -3]}
      />
    </>
  );
}

class PreviewErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(err: unknown): void {
    console.warn("[picker3d] preview model failed to load", err);
  }
  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useCleanClone(scene: THREE.Object3D): THREE.Object3D {
  return useMemo(() => {
    const c = cloneSkinned(scene);
    c.traverse((o) => {
      if (HELD_ITEM.test(o.name) && !(o as THREE.Bone).isBone)
        o.visible = false;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
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
  }, [scene]);
}

/** Hold an action still at `time` (the reduced-motion pose). */
function freezeAt(
  action: THREE.AnimationAction,
  mixer: THREE.AnimationMixer,
  time: number
): void {
  action.time = Math.min(time, action.getClip().duration);
  action.paused = true;
  mixer.update(0);
}

function playOnce(action: THREE.AnimationAction): void {
  action.reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = false;
}

const BASE_YAW = -0.28;
const ACTIVE_YAW = 0.42;

function AnimatedCharacter({
  url,
  scale,
  active,
  still,
  poseTime,
  onReady,
}: {
  url: string;
  scale: number;
  active: boolean;
  still: boolean;
  poseTime: number;
  onReady?: (() => void) | undefined;
}): ReactNode {
  const gltf = useGLTF(url);
  const scene = useCleanClone(gltf.scene);
  const root = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const { actions, names, mixer } = useAnimations(gltf.animations, root);
  const invalidate = useThree((s) => s.invalidate);
  const clips = useMemo(() => {
    const picked = pickClips(names);
    const find = (re: RegExp): string | null =>
      names.find((n) => re.test(n)) ?? null;
    return {
      idle: picked.idle,
      cheer: find(/^cheer$/i) ?? find(/^interact$/i) ?? find(/emote-yes/i),
    };
  }, [names]);

  // Idle (or a frozen idle pose when motion is reduced).
  useEffect(() => {
    const idle = clips.idle ? actions[clips.idle] : null;
    if (!idle) {
      onReady?.();
      return;
    }
    idle.reset().setEffectiveWeight(1).play();
    if (still) freezeAt(idle, mixer, poseTime);
    invalidate();
    onReady?.();
    return () => {
      idle.stop();
    };
    // onReady is a fire-once notifier; re-running for a new callback identity would restart the idle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, clips.idle, still, poseTime, mixer, invalidate]);

  // Hover or focus: a short cheer, then back to idle.
  useEffect(() => {
    if (!active || still || !clips.cheer || !clips.idle) return;
    const cheer = actions[clips.cheer];
    const idle = actions[clips.idle];
    if (!cheer || !idle) return;
    playOnce(cheer);
    cheer.setEffectiveTimeScale(1.15).setEffectiveWeight(1).fadeIn(0.2).play();
    idle.fadeOut(0.2);
    const onFinished = (e: { action: THREE.AnimationAction }): void => {
      if (e.action !== cheer) return;
      idle.reset().setEffectiveWeight(1).fadeIn(0.3).play();
      cheer.fadeOut(0.3);
    };
    mixer.addEventListener("finished", onFinished);
    return () => {
      mixer.removeEventListener("finished", onFinished);
      if (cheer.isRunning()) {
        idle.reset().setEffectiveWeight(1).fadeIn(0.25).play();
        cheer.fadeOut(0.25);
      }
    };
  }, [active, still, actions, clips.cheer, clips.idle, mixer]);

  useFrame((_, delta) => {
    const g = turn.current;
    if (!g) return;
    const target = still ? BASE_YAW : active ? ACTIVE_YAW : BASE_YAW;
    g.rotation.y = still
      ? target
      : THREE.MathUtils.damp(g.rotation.y, target, 6, delta);
  });

  return (
    <group ref={turn} rotation={[0, BASE_YAW, 0]}>
      <group ref={root}>
        <primitive object={scene} scale={scale} />
      </group>
    </group>
  );
}

function ReadyNow({ onReady }: { onReady?: (() => void) | undefined }): null {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

/** One picker character: its KayKit model idling (or a still pose), or the capsule placeholder. */
export function PreviewCharacter({
  charId,
  model,
  active = false,
  still = false,
  poseTime = 0,
  onReady,
}: {
  charId: string;
  model: PreviewModel;
  active?: boolean;
  still?: boolean;
  poseTime?: number;
  onReady?: (() => void) | undefined;
}): ReactNode {
  const capsule = (
    <>
      <CapsuleCharacter color={CHARACTER_COLORS[charId] ?? "#d4a359"} />
      <ReadyNow onReady={onReady} />
    </>
  );
  if (!model) return capsule;
  return (
    <PreviewErrorBoundary key={model.url} fallback={capsule}>
      <Suspense fallback={null}>
        <AnimatedCharacter
          url={model.url}
          scale={model.scale}
          active={active}
          still={still}
          poseTime={poseTime}
          onReady={onReady}
        />
      </Suspense>
    </PreviewErrorBoundary>
  );
}
