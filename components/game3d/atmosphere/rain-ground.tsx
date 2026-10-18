"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

import { createRng, seedFromString } from "../logic/noise";
import { buildRoadNetwork } from "../logic/roads";
import { surfaceAt } from "../logic/walk-world";
import type { GameWorld } from "../logic/world-layout";
import { islandBob, useRuntimeRef } from "../runtime";
import { live } from "./live";
import { atmosphere } from "./store";
import { setUniform } from "../fx/assign";

const SPLASH_LIFE = 0.45;

const SPLASH_VERT = /* glsl */ `
  attribute vec4 aDrop;
  uniform float uTime;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    vUv = position.xy + 0.5;
    vAge = clamp((uTime - aDrop.w) / ${SPLASH_LIFE.toFixed(2)}, 0.0, 1.0);
    float r = 0.06 + vAge * 0.22;
    vec3 p = aDrop.xyz + vec3(position.x * r, 0.02, position.y * r);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const SPLASH_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    float d = length(vUv - 0.5);
    float ring = smoothstep(0.08, 0.0, abs(d - 0.4)) + smoothstep(0.18, 0.0, d) * (1.0 - vAge) * 0.6;
    float a = ring * (1.0 - vAge) * uOpacity * step(vAge, 0.999);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(0.86, 0.91, 0.97), a);
    #include <colorspace_fragment>
  }
`;

/** Ground splashes: a ring buffer of drops landing on the walkable ground near the player. */
function Splashes({
  world,
  count,
}: {
  world: GameWorld;
  count: number;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const mesh = useRef<THREE.Mesh>(null);
  const { geometry, material, uniforms } = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    const drops = new Float32Array(count * 4).fill(-100);
    g.setAttribute("aDrop", new THREE.InstancedBufferAttribute(drops, 4));
    g.instanceCount = count;
    const uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SPLASH_VERT,
      fragmentShader: SPLASH_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { geometry: g, material, uniforms };
  }, [count]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  const st = useRef({ next: 0, acc: 0 });
  useFrame(({ clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const rain = atmosphere.rain;
    m.visible = rain > 0.02;
    if (!m.visible) return;
    const t = clock.elapsedTime;
    setUniform(uniforms.uTime, t);
    setUniform(uniforms.uOpacity, Math.min(1, rain * 1.2) * 0.7);
    const s = st.current;
    s.acc += dt * rain * (count / SPLASH_LIFE);
    const attr = geometry.getAttribute(
      "aDrop"
    ) as THREE.InstancedBufferAttribute;
    const p = rtRef.current.player.pos;
    let wrote = false;
    while (s.acc >= 1) {
      s.acc -= 1;
      const x = p.x + (Math.random() - 0.5) * 18;
      const z = p.z + (Math.random() - 0.5) * 18;
      const surf = surfaceAt(world.walk, x, z, p.y);
      if (!surf) continue;
      attr.setXYZW(s.next, x, surf.y + 0.05, z, t - Math.random() * 0.05);
      s.next = (s.next + 1) % count;
      wrote = true;
    }
    if (wrote) attr.needsUpdate = true;
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

const PUDDLE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = position.xy + 0.5;
    vec4 w = modelMatrix * instanceMatrix * vec4(position.x, 0.0, position.y, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const PUDDLE_FRAG = /* glsl */ `
  uniform float uRain;
  uniform float uTime;
  uniform vec3 uSky;
  varying vec2 vUv;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 c = vUv - 0.5;
    float wob = sin(atan(c.y, c.x) * 3.0 + hash(floor(vWorld.xz)) * 6.0) * 0.05;
    float d = length(c) + wob;
    float a = smoothstep(0.5, 0.36, d);
    if (a < 0.01) discard;
    // A wet, sky-tinted sheen with drop rings.
    vec2 g = vWorld.xz * 3.0;
    vec2 id = floor(g);
    float h = hash(id);
    float life = fract(uTime * 1.1 + h);
    float ring = smoothstep(0.06, 0.0, abs(length(fract(g) - 0.5) - life * 0.45)) * (1.0 - life);
    vec3 col = mix(vec3(0.16, 0.15, 0.17), uSky, 0.55) + ring * 0.25;
    gl_FragColor = vec4(col, a * uRain * 0.7);
    #include <colorspace_fragment>
  }
`;

/** Puddles on one island's roads (mounted the first time it rains). */
function IslandPuddles({
  world,
  islandId,
  reducedMotion,
}: {
  world: GameWorld;
  islandId: string;
  reducedMotion: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const island = world.islands.find((i) => i.id === islandId);
    const grid = world.walk.islands.find((g) => g.islandId === islandId);
    if (!island || !grid) return [];
    const net = buildRoadNetwork(island, grid, {
      heightJitter: island.heightJitter ?? 0,
    });
    const rng = createRng(seedFromString(`puddles/${islandId}`));
    const out: { x: number; y: number; z: number; s: number; r: number }[] = [];
    for (const path of net.paths) {
      for (let i = 3; i < path.points.length - 3; i += 7) {
        if (rng() < 0.45) continue;
        const pt = path.points[i];
        const nx = path.points[i + 1];
        if (!pt || !nx) continue;
        const dx = nx.x - pt.x;
        const dz = nx.z - pt.z;
        const len = Math.hypot(dx, dz) || 1;
        const side = (rng() - 0.5) * net.width * 0.45;
        out.push({
          x: pt.x + (-dz / len) * side,
          y: pt.y + 0.075,
          z: pt.z + (dx / len) * side,
          s: 0.45 + rng() * 0.6,
          r: Math.atan2(dx, dz),
        });
      }
    }
    return out.slice(0, 40);
  }, [world, islandId]);
  const uniforms = useMemo(
    () => ({
      uRain: { value: 0 },
      uTime: { value: 0 },
      uSky: { value: live.upper },
    }),
    []
  );
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: PUDDLE_VERT,
        fragmentShader: PUDDLE_FRAG,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [uniforms]
  );
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const tmp = new THREE.Object3D();
    spots.forEach((s, i) => {
      tmp.position.set(s.x, s.y, s.z);
      tmp.rotation.set(0, s.r, 0);
      tmp.scale.set(s.s * 1.4, 1, s.s);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [spots]);
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry]
  );
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.visible = atmosphere.rain > 0.02;
    if (!g.visible) return;
    setUniform(uniforms.uRain, atmosphere.rain);
    if (!reducedMotion) setUniform(uniforms.uTime, clock.elapsedTime);
    g.position.y = islandBob(
      islandId,
      clock.elapsedTime,
      rtRef.current.reducedMotion
    );
  });
  if (spots.length === 0) return null;
  return (
    <group ref={group}>
      <instancedMesh
        ref={mesh}
        args={[geometry, material, spots.length]}
        frustumCulled={false}
        renderOrder={1}
      />
    </group>
  );
}

/** Rain on the ground: splashes near the player and puddle sheen on the paths. */
export function RainGround({
  world,
  phone,
  reducedMotion,
}: {
  world: GameWorld;
  phone: boolean;
  reducedMotion: boolean;
}): ReactNode {
  const [rained, setRained] = useState(false);
  useFrame(() => {
    if (!rained && atmosphere.rain > 0.01) setRained(true);
  });
  if (!rained) return null;
  return (
    <>
      {!reducedMotion && <Splashes world={world} count={phone ? 24 : 56} />}
      {world.islands.map((i) => (
        <IslandPuddles
          key={i.id}
          world={world}
          islandId={i.id}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}
