"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import type { Vec3 } from "../logic/walk-world";
import type { GameWorld } from "../logic/world-layout";
import { useRuntimeRef, type Runtime } from "../runtime";
import { fireflyAnchors, nearestAnchors, objectAnchors } from "./anchors";
import { live } from "./live";
import {
  createParticleGeometry,
  createParticleMaterial,
  type ParticleKind,
} from "./particle-material";
import { atmosphere } from "./store";
import { setUniform } from "../fx/assign";

/** One particle field: what it is, where it lives and how strongly it shows. */
export type FieldSpec = {
  id: string;
  kind: ParticleKind;
  count: number;
  colors: [string, string];
  size?: number;
  /** Field kinds: the wrap box around the player (metres) and its height offset. */
  box?: [number, number, number];
  lift?: number;
  /** Only on this island (the last island the player stood on). */
  island?: string;
  /** Anchored kinds: the spots the particles gather around. */
  anchors?: readonly Vec3[];
  /** Target opacity (0..1) from the live atmosphere. */
  opacity: () => number;
  /** Tint from the fog colour (mist). */
  fogTint?: boolean;
  /** Still shown (frozen) under reduced motion. */
  keepStill?: boolean;
};

/** Anchored fields hide when the nearest anchor is further than this (metres). */
const ANCHOR_RANGE = 26;
const ANCHORS_PER_FIELD = 12;

function ParticleField({
  spec,
  reducedMotion,
  lastIsland,
}: {
  spec: FieldSpec;
  reducedMotion: boolean;
  lastIsland: { current: string | null };
}): ReactNode {
  const rtRef = useRuntimeRef();
  const mesh = useRef<THREE.Mesh>(null);
  const { geometry, material, uniforms } = useMemo(() => {
    const geometry = createParticleGeometry(
      spec.count,
      spec.id.length * 7919 + spec.count
    );
    const { material, uniforms } = createParticleMaterial(
      spec.kind,
      spec.colors
    );
    if (spec.box) uniforms.uBox.value.set(...spec.box);
    uniforms.uSize.value = spec.size ?? 0.1;
    return { geometry, material, uniforms };
  }, [spec]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  const state = useRef({
    opacity: 0,
    timer: 1,
    near: [] as Vec3[],
    dist: [] as number[],
    inRange: false,
  });

  useFrame(({ clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const rt: Runtime = rtRef.current;
    const s = state.current;
    const p = rt.player.pos;
    let target = spec.opacity();
    if (spec.island && lastIsland.current !== spec.island) target = 0;
    if (reducedMotion && !spec.keepStill) target = 0;
    // Anchored kinds: re-pick the nearest anchors about once a second.
    if (spec.anchors) {
      s.timer += dt;
      if (s.timer > 1) {
        s.timer = 0;
        const n = nearestAnchors(
          spec.anchors,
          p.x,
          p.z,
          ANCHORS_PER_FIELD,
          s.near,
          s.dist
        );
        s.inRange = n > 0 && (s.dist[0] ?? Infinity) < ANCHOR_RANGE ** 2;
        if (s.inRange) {
          const attr = geometry.getAttribute(
            "aOrigin"
          ) as THREE.InstancedBufferAttribute;
          for (let i = 0; i < spec.count; i++) {
            const a = s.near[i % n] as Vec3;
            attr.setXYZ(i, a.x, a.y, a.z);
          }
          attr.needsUpdate = true;
        }
      }
      if (!s.inRange) target = 0;
    }
    s.opacity += (target - s.opacity) * Math.min(1, dt * 1.5);
    const visible = s.opacity > 0.004;
    m.visible = visible;
    if (!visible) return;
    if (!reducedMotion) setUniform(uniforms.uTime, clock.elapsedTime);
    uniforms.uCenter.value.set(p.x, p.y + (spec.lift ?? 0), p.z);
    setUniform(uniforms.uOpacity, s.opacity);
    setUniform(uniforms.uGust, atmosphere.gust);
    if (spec.fogTint) {
      uniforms.uColor.value.copy(live.fog).lerp(live.cloud, 0.5);
      uniforms.uColor2.value.copy(live.haze);
    }
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={4}
      visible={false}
    />
  );
}

const daylight = (): number => atmosphere.daylight * (1 - atmosphere.rain);

/** Every particle field of the world (seasons per island, weather, night). */
export function buildFieldSpecs(world: GameWorld, phone: boolean): FieldSpec[] {
  const c = (desktop: number): number =>
    phone ? Math.round(desktop / 2) : desktop;
  return [
    {
      id: "leaves",
      kind: "leaf",
      island: "saleh",
      count: c(60),
      box: [22, 9, 22],
      lift: 3.5,
      colors: ["#d9622b", "#e9a838"],
      opacity: () => 0.95,
    },
    {
      id: "petals",
      kind: "petal",
      island: "eyad",
      count: c(70),
      box: [22, 8, 22],
      lift: 3,
      colors: ["#f5a9c6", "#fff0f5"],
      opacity: () => 0.9,
    },
    {
      id: "sand",
      kind: "sand",
      island: "onyx",
      count: c(50),
      box: [18, 2.2, 18],
      lift: 0.7,
      colors: ["#fff0cf", "#e9c58e"],
      // Occasional: only while a gust blows.
      opacity: () =>
        Math.min(1, Math.max(0, atmosphere.gust - 0.3) * 2.2) *
        (1 - atmosphere.rain),
    },
    {
      id: "haze",
      kind: "haze",
      island: "onyx",
      count: c(10),
      box: [14, 1.2, 14],
      lift: 0.55,
      colors: ["#fff3dc", "#ffe7c4"],
      opacity: () => daylight() * 0.12,
    },
    {
      id: "mist",
      kind: "mist",
      count: c(16),
      box: [28, 1.4, 28],
      lift: 0.3,
      colors: ["#f3ecf2", "#e9e4f0"],
      fogTint: true,
      keepStill: true,
      opacity: () => live.mist * 0.5 + atmosphere.rain * 0.12,
    },
    {
      id: "rain",
      kind: "rain",
      count: c(600),
      box: [26, 16, 26],
      lift: 4,
      colors: ["#c9d6e8", "#eaf1fa"],
      opacity: () => atmosphere.rain * 0.7,
    },
    {
      id: "motes",
      kind: "mote",
      count: c(40),
      size: 0.09,
      colors: ["#7ff3ff", "#d6fdff"],
      anchors: objectAnchors(world, "civicmind", /crystal-lamp/, 0.3),
      opacity: () => 0.4 + atmosphere.night * 0.6,
    },
    {
      id: "sparks",
      kind: "spark",
      count: c(24),
      colors: ["#ffa53a", "#ffe08a"],
      anchors: objectAnchors(world, "khidmty", /workbench-anvil/),
      opacity: () => 1 - atmosphere.rain * 0.6,
    },
    {
      id: "butterflies",
      kind: "butterfly",
      count: c(10),
      colors: ["#ffcf3f", "#a8d4ff"],
      anchors: objectAnchors(world, "home", /flower/),
      opacity: () => daylight(),
    },
    {
      id: "fireflies",
      kind: "firefly",
      count: c(40),
      colors: ["#d9ff6e", "#fff2a0"],
      anchors: fireflyAnchors(world),
      opacity: () =>
        Math.max(0, atmosphere.night - 0.3) * 1.4 * (1 - atmosphere.rain * 0.8),
    },
  ];
}

/** The particle fields, gated by island, time of day and weather. */
export function AtmosphereParticles({
  world,
  phone,
  reducedMotion,
}: {
  world: GameWorld;
  phone: boolean;
  reducedMotion: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const specs = useMemo(() => buildFieldSpecs(world, phone), [world, phone]);
  const lastIsland = useRef<string | null>(null);
  useFrame(() => {
    const id = rtRef.current.player.islandId;
    if (id) lastIsland.current = id;
  });
  return (
    <>
      {specs.map((s) => (
        <ParticleField
          key={s.id}
          spec={s}
          reducedMotion={reducedMotion}
          lastIsland={lastIsland}
        />
      ))}
    </>
  );
}
