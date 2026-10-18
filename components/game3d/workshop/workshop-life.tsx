"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import { WORKSHOP } from "@/content/islands3d";
import type {
  WorkshopPuff,
  WorkshopWorker,
} from "@/content/islands3d/workshop";
import { modelUrl } from "../assets/manifest";
import { collectMeshParts } from "../assets/prepare";
import { zoomToDistance } from "../logic/camera-math";
import { hexKey } from "../logic/hex";
import type { Manifest } from "../logic/types";
import type { IslandWalkGrid } from "../logic/walk-grid";
import type { GameWorld } from "../logic/world-layout";
import { islandBob, useRuntimeRef } from "../runtime";

/**
 * Life on the workshop island ("Under construction"): the tower crane's jib slowly swings
 * with its load bobbing on the cable, two or three KayKit workers loop work animations
 * next to the half-built houses, and small dust puffs rise from the sites. Everything
 * mounts the first time the player comes near the island (like the island props), and
 * stands still under prefers-reduced-motion (no swing, no dust).
 */

const ISLAND_ID = "workshop";
/** Mount when the player is this close to the island rim (plus the camera distance). */
const NEAR = 16;
/** Top of the mast and the trolley's place on the jib (scripts/3d/procedural/v2-construction.mjs). */
const MAST_H = 5.2;
const TROLLEY: [number, number, number] = [3.1, 0.48, 0];
const PUFFS_PER_SITE = 3;
const HELD_ITEM =
  /sword|axe|knife|dagger|crossbow|shield|staff|wand|spellbook|mug|throwable|bow$/i;

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(err: unknown): void {
    console.warn("[game3d] workshop model failed to load", err);
  }
  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

function at(
  grid: IslandWalkGrid,
  q: number,
  r: number,
  offset?: readonly [number, number]
): THREE.Vector3 | null {
  const cell = grid.cells.get(hexKey(q, r));
  if (!cell) return null;
  return new THREE.Vector3(
    cell.x + (offset?.[0] ?? 0),
    cell.y,
    cell.z + (offset?.[1] ?? 0)
  );
}

/** A static model drawn as plain meshes (one copy each, so no instancing needed). */
function StaticModel({ url }: { url: string }): ReactNode {
  const gltf = useGLTF(url);
  const parts = useMemo(() => collectMeshParts(gltf.scene, false), [gltf]);
  return (
    <>
      {parts.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geometry}
          material={p.material}
          matrixAutoUpdate={false}
          matrix={p.matrix}
          castShadow
          receiveShadow
        />
      ))}
    </>
  );
}

function Crane({
  pos,
  scale,
  manifest,
  phase,
}: {
  pos: THREE.Vector3;
  scale: number;
  manifest: Manifest | null;
  phase: number;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const jib = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const jibUrl = modelUrl(manifest, "v2-crane-jib");
  const loadUrl = modelUrl(manifest, "v2-crane-load");
  useFrame(({ clock }) => {
    const still = rtRef.current.reducedMotion;
    const t = clock.elapsedTime + phase;
    // A slow sweep back and forth over the site (about a minute per swing).
    if (jib.current)
      jib.current.rotation.y = phase + (still ? 0 : Math.sin(t * 0.1) * 1.3);
    if (load.current) {
      load.current.position.y =
        TROLLEY[1] + (still ? 0 : Math.sin(t * 0.35) * 0.35);
      load.current.rotation.z = still ? 0 : Math.sin(t * 0.9) * 0.025;
      load.current.rotation.y = still ? 0 : Math.sin(t * 0.21) * 0.4;
    }
  });
  if (!jibUrl || !loadUrl) return null;
  return (
    <group position={pos} scale={scale}>
      <group ref={jib} position={[0, MAST_H, 0]}>
        <StaticModel url={jibUrl} />
        <group ref={load} position={TROLLEY}>
          <StaticModel url={loadUrl} />
        </group>
      </group>
    </group>
  );
}

function Worker({
  worker,
  pos,
  manifest,
  seed,
}: {
  worker: WorkshopWorker;
  pos: THREE.Vector3;
  manifest: Manifest | null;
  seed: number;
}): ReactNode {
  const url = modelUrl(manifest, worker.model);
  const scale = manifest?.models[worker.model]?.scale ?? 1;
  if (!url) return null;
  return (
    <group position={pos} rotation={[0, (worker.rot * Math.PI) / 180, 0]}>
      <WorkerModel url={url} scale={scale} clip={worker.clip} seed={seed} />
    </group>
  );
}

function WorkerModel({
  url,
  scale,
  clip,
  seed,
}: {
  url: string;
  scale: number;
  clip: string;
  seed: number;
}): ReactNode {
  const gltf = useGLTF(url);
  const root = useRef<THREE.Group>(null);
  const scene = useMemo(() => {
    const c = cloneSkinned(gltf.scene);
    c.traverse((o) => {
      if (HELD_ITEM.test(o.name) && !(o as THREE.Bone).isBone)
        o.visible = false;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        if (mesh.material instanceof THREE.MeshBasicMaterial) {
          const m = mesh.material;
          mesh.material = new THREE.MeshLambertMaterial({
            color: m.color,
            map: m.map,
            transparent: m.transparent,
          });
        }
      }
    });
    return c;
  }, [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, root);
  useEffect(() => {
    const name =
      names.find((n) => n === clip) ??
      names.find((n) => /interact|use_item/i.test(n)) ??
      names.find((n) => /idle/i.test(n));
    const action = name ? actions[name] : null;
    if (!action) return;
    // Staggered starts and speeds so the workers never move in step.
    action
      .reset()
      .setLoop(THREE.LoopRepeat, Infinity)
      .setEffectiveTimeScale(0.85 + (seed % 3) * 0.08)
      .startAt(action.getMixer().time + seed * 0.6)
      .play();
    return () => {
      action.stop();
    };
  }, [actions, names, clip, seed]);
  return (
    <group ref={root}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

/** Dust puffs: one instanced mesh; each puff grows, rises and shrinks on its own cycle. */
function Dust({ sites }: { sites: THREE.Vector3[] }): ReactNode {
  const rtRef = useRuntimeRef();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = sites.length * PUFFS_PER_SITE;
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.16, 0), []);
  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: "#e6d6b8",
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    []
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const still = rtRef.current.reducedMotion;
    m.visible = !still;
    if (still) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const site = sites[Math.floor(i / PUFFS_PER_SITE)]!;
      const k = i % PUFFS_PER_SITE;
      const period = 3.2 + k * 0.7;
      const u = ((t + i * 1.37) % period) / period;
      // Only the first part of each cycle shows a puff (short bursts, then a pause).
      const life = u < 0.55 ? u / 0.55 : 1;
      const s = life >= 1 ? 0 : Math.sin(life * Math.PI) * (0.7 + k * 0.25);
      const a = i * 2.39996;
      tmp.position.set(
        site.x + Math.cos(a) * (0.15 + life * 0.35),
        site.y + 0.12 + life * 0.55,
        site.z + Math.sin(a) * (0.15 + life * 0.35)
      );
      tmp.rotation.set(a, a * 0.5, 0);
      tmp.scale.setScalar(Math.max(0.0001, s));
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  if (count === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
}

export function WorkshopLife({
  world,
  manifest,
}: {
  world: GameWorld;
  manifest: Manifest | null;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const group = useRef<THREE.Group>(null);
  const [near, setNear] = useState(false);
  const frame = useRef(0);

  const layout = useMemo(() => {
    const island = world.islands.find((i) => i.id === ISLAND_ID);
    const grid = world.walk.islands.find((g) => g.islandId === ISLAND_ID);
    if (!island || !grid) return null;
    const cranes = (island.objects ?? [])
      .filter((o) => o.model === "v2-crane-mast")
      .map((o, i) => ({
        pos: at(grid, o.q, o.r, o.offset),
        scale: o.scale ?? 1,
        phase: ((o.rot ?? 0) * Math.PI) / 180 + i * 1.7,
      }))
      .filter((c): c is { pos: THREE.Vector3; scale: number; phase: number } =>
        Boolean(c.pos)
      );
    const workers = WORKSHOP.workers
      .map((w) => ({ worker: w, pos: at(grid, w.q, w.r, w.offset) }))
      .filter((w): w is { worker: WorkshopWorker; pos: THREE.Vector3 } =>
        Boolean(w.pos)
      );
    const puffs = WORKSHOP.puffs
      .map((p: WorkshopPuff) => at(grid, p.q, p.r, p.offset))
      .filter((p): p is THREE.Vector3 => Boolean(p));
    let radius = 0;
    for (const c of grid.cells.values())
      radius = Math.max(
        radius,
        Math.hypot(c.x - grid.origin.x, c.z - grid.origin.z)
      );
    return { origin: grid.origin, radius, cranes, workers, puffs };
  }, [world]);

  useFrame(({ clock }) => {
    const rt = rtRef.current;
    if (group.current)
      group.current.position.y = islandBob(
        ISLAND_ID,
        clock.elapsedTime,
        rt.reducedMotion
      );
    frame.current = (frame.current + 1) % 20;
    if (frame.current !== 0 || near || !layout) return;
    const p = rt.player.pos;
    const gap =
      Math.hypot(p.x - layout.origin.x, p.z - layout.origin.z) - layout.radius;
    if (gap < NEAR + zoomToDistance(rt.camera.zoom)) setNear(true);
  });

  if (!layout) return null;
  return (
    <group ref={group}>
      {near && (
        <Quiet>
          <Suspense fallback={null}>
            {layout.cranes.map((c, i) => (
              <Crane
                key={i}
                pos={c.pos}
                scale={c.scale}
                phase={c.phase}
                manifest={manifest}
              />
            ))}
            {layout.workers.map((w, i) => (
              <Worker
                key={w.worker.id}
                worker={w.worker}
                pos={w.pos}
                manifest={manifest}
                seed={i + 1}
              />
            ))}
            <Dust sites={layout.puffs} />
          </Suspense>
        </Quiet>
      )}
    </group>
  );
}
