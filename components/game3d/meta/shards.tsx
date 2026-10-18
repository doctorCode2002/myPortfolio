"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { SHARD_PICKUP_RANGE } from "@/lib/content/collectibles";
import { emitSoundCue } from "../audio/sound-store";
import { assign } from "../fx/assign";
import { createMistTexture } from "../island/geometry";
import type { GameWorld } from "../logic/world-layout";
import { islandBob, useRuntimeRef } from "../runtime";
import { placeShards } from "./placement";
import { collectShard, liveProgress, liveUi } from "./store";

const SPARKS = 28;
const SPARK_LIFE = 0.9;
const HIDDEN_Y = -9999;

/** A stable pseudo-random value in [0, 1) for spark directions. */
function rand(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The sky shards: spinning low-poly crystals (one instanced mesh) with a soft additive glow
 * (one points cloud), picked up by walking (or driving) within reach. A pickup plays a
 * chime cue and a sparkle burst. With reduced motion they stand still and the burst is a
 * single soft flash.
 */
export function Shards({
  world,
  reducedMotion,
}: {
  world: GameWorld;
  reducedMotion: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const placed = useMemo(() => placeShards(world), [world]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const glow = useRef<THREE.Points>(null);
  const sparks = useRef<THREE.Points>(null);
  const state = useRef({
    found: new Set<string>(),
    sparkT: -1,
    sparkX: 0,
    sparkY: 0,
    sparkZ: 0,
    frame: 0,
  });

  const geometry = useMemo(() => {
    const g = new THREE.OctahedronGeometry(0.2, 0);
    g.scale(0.85, 1.7, 0.85);
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#a8ecff",
        emissive: "#48c8ff",
        emissiveIntensity: 1.1,
        roughness: 0.25,
        metalness: 0.1,
        flatShading: true,
      }),
    []
  );
  const glowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(placed.length * 3), 3)
    );
    return g;
  }, [placed.length]);
  const glowMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: createMistTexture(),
        color: "#7fdcff",
        size: 1.5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  );
  const sparkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3)
    );
    // Fixed scattered directions (unit-ish), reused for every burst.
    const dirs = new Float32Array(SPARKS * 3);
    for (let i = 0; i < SPARKS; i++) {
      const a = (i / SPARKS) * Math.PI * 2 + rand(i * 3) * 0.3;
      const up = 0.4 + rand(i * 3 + 1) * 1.2;
      const r = 0.8 + rand(i * 3 + 2) * 0.8;
      dirs[i * 3] = Math.cos(a) * r;
      dirs[i * 3 + 1] = up;
      dirs[i * 3 + 2] = Math.sin(a) * r;
    }
    g.userData.dirs = dirs;
    return g;
  }, []);
  const sparkMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: createMistTexture(),
        color: "#fff3b0",
        size: 0.35,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      glowGeo.dispose();
      glowMat.map?.dispose();
      glowMat.dispose();
      sparkGeo.dispose();
      sparkMat.map?.dispose();
      sparkMat.dispose();
    },
    [geometry, material, glowGeo, glowMat, sparkGeo, sparkMat]
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, rawDt) => {
    const m = mesh.current;
    const gp = glow.current;
    if (!m || !gp) return;
    const s = state.current;
    const rt = rtRef.current;
    const t = clock.elapsedTime;
    const progress = liveProgress();
    const found = s.found;
    // Sync the found set from the store (cheap: 14 ids).
    if (found.size !== progress.shards.length) {
      found.clear();
      for (const id of progress.shards) found.add(id);
    }
    const p = rt.player.pos;
    const canPick = rt.placed && !rt.frozen && liveUi().travel.phase === "idle";
    const pos = gp.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < placed.length; i++) {
      const sh = placed[i] as (typeof placed)[number];
      const isFound = found.has(sh.id);
      if (
        !isFound &&
        canPick &&
        Math.abs(p.x - sh.x) < SHARD_PICKUP_RANGE &&
        Math.abs(p.z - sh.z) < SHARD_PICKUP_RANGE &&
        Math.hypot(p.x - sh.x, p.z - sh.z) < SHARD_PICKUP_RANGE &&
        Math.abs(p.y - sh.ground) < 1.8 &&
        collectShard(sh.id)
      ) {
        found.add(sh.id);
        emitSoundCue({ kind: "chime", strength: 1 });
        s.sparkT = 0;
        s.sparkX = sh.x;
        s.sparkY = sh.y;
        s.sparkZ = sh.z;
      }
      const bob = islandBob(sh.islandId, t, reducedMotion);
      if (found.has(sh.id)) {
        dummy.position.set(sh.x, HIDDEN_Y, sh.z);
        dummy.scale.setScalar(0);
        pos.setXYZ(i, sh.x, HIDDEN_Y, sh.z);
      } else {
        const hover = reducedMotion ? 0 : Math.sin(t * 1.6 + i) * 0.08;
        dummy.position.set(sh.x, sh.y + bob + hover, sh.z);
        dummy.rotation.set(0, reducedMotion ? i * 0.7 : t * 1.3 + i, 0);
        dummy.scale.setScalar(1);
        pos.setXYZ(i, sh.x, sh.y + bob + hover, sh.z);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    pos.needsUpdate = true;
    // A soft pulse on the glow (static with reduced motion).
    assign(
      glowMat,
      "opacity",
      reducedMotion ? 0.8 : 0.7 + Math.sin(t * 2.2) * 0.15
    );

    // The sparkle burst.
    const sp = sparks.current;
    if (sp) {
      if (s.sparkT < 0) {
        sp.visible = false;
      } else {
        s.sparkT += Math.min(rawDt, 0.05);
        const k = s.sparkT / SPARK_LIFE;
        if (k >= 1) {
          s.sparkT = -1;
          sp.visible = false;
        } else {
          sp.visible = true;
          const arr = (sp.geometry.attributes.position as THREE.BufferAttribute)
            .array as Float32Array;
          const dirs = sp.geometry.userData.dirs as Float32Array;
          // Reduced motion: the sparks stay together as one fading flash.
          const spread = reducedMotion ? 0 : 1 - (1 - k) * (1 - k);
          for (let i = 0; i < SPARKS; i++) {
            arr[i * 3] = s.sparkX + (dirs[i * 3] ?? 0) * spread;
            arr[i * 3 + 1] =
              s.sparkY +
              (dirs[i * 3 + 1] ?? 0) * spread -
              spread * spread * 0.6;
            arr[i * 3 + 2] = s.sparkZ + (dirs[i * 3 + 2] ?? 0) * spread;
          }
          sp.geometry.attributes.position!.needsUpdate = true;
          assign(sparkMat, "opacity", 1 - k);
          assign(sparkMat, "size", reducedMotion ? 1.4 * (1 - k * 0.5) : 0.35);
        }
      }
    }
  });

  return (
    <group name="meta-shards">
      <instancedMesh
        ref={mesh}
        args={[geometry, material, placed.length]}
        castShadow
        frustumCulled={false}
      />
      <points
        ref={glow}
        geometry={glowGeo}
        material={glowMat}
        frustumCulled={false}
      />
      <points
        ref={sparks}
        geometry={sparkGeo}
        material={sparkMat}
        visible={false}
        frustumCulled={false}
      />
    </group>
  );
}
