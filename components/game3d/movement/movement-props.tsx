"use client";

/**
 * The movement props, all procedural and low-poly: glider launch platforms (a wooden deck
 * with a launch lip and a windsock), springy mushroom-cushion jump pads (instanced, they
 * squash when they fire), the stone lookout towers with their wooden decks and rails, and
 * faint thermal columns that only show while gliding. No cross shapes: the rails meet the
 * posts at their tops (L and T joints), the windsock is a pole and a cone.
 */

import { useFrame } from "@react-three/fiber";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";

import type {
  JumpPad,
  LaunchSpot,
  Lookout,
  MovementLayout,
  Thermal,
} from "../logic/movement-layout";
import { setUniform } from "../fx/assign";
import { useRuntimeRef } from "../runtime";

/** The pad that fired last and when (seconds of the scene clock), for the squash. */
export type PadBounce = { id: string; at: number } | null;

const WOOD = "#a8703f";
const WOOD_DARK = "#7a4f2b";
const STONE = "#a3a19b";
const CUSHION = "#e25a48";
const STEM = "#f2e4c4";
const DOT = "#fff6e2";
const SOCK = "#f08a3c";

const BOUNCE_TIME = 0.45;

const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpE = new THREE.Euler();

/** Squash factor of a pad `age` seconds after it fired (1 = rest). */
function squash(age: number): number {
  if (age < 0 || age > BOUNCE_TIME) return 1;
  const k = age / BOUNCE_TIME;
  return 1 - Math.sin(k * Math.PI) * 0.45 * (1 - k * 0.5);
}

function LaunchPlatform({
  spot,
  reducedMotion,
}: {
  spot: LaunchSpot;
  reducedMotion: boolean;
}): ReactNode {
  const sock = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const s = sock.current;
    if (!s || reducedMotion) return;
    const t = clock.elapsedTime;
    s.rotation.y = Math.sin(t * 0.7) * 0.25;
    s.rotation.z = Math.sin(t * 1.9) * 0.06;
  });
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.heading, 0]}>
      {/* Deck on a low frame. */}
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.78, 0.84, 0.16, 6]} />
        <meshStandardMaterial color={WOOD} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.7, 0.74, 0.08, 6]} />
        <meshStandardMaterial color={WOOD_DARK} flatShading roughness={0.9} />
      </mesh>
      {/* Launch lip pointing out along the heading. */}
      <mesh
        position={[0, 0.2, 0.86]}
        rotation={[-0.22, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.9, 0.06, 0.5]} />
        <meshStandardMaterial color={WOOD} flatShading roughness={0.9} />
      </mesh>
      {/* Windsock: a pole and a striped cone. */}
      <group position={[-0.58, 0.2, -0.42]}>
        <mesh position={[0, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 1.9, 6]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>
        <group ref={sock} position={[0, 1.78, 0]}>
          <mesh
            position={[0, 0, 0.3]}
            rotation={[-Math.PI / 2, 0, 0]}
            castShadow
          >
            <coneGeometry args={[0.13, 0.62, 8, 1, true]} />
            <meshStandardMaterial
              color={SOCK}
              flatShading
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.135, 0.135, 0.1, 8, 1, true]} />
            <meshStandardMaterial
              color={DOT}
              flatShading
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function LookoutTower({ look }: { look: Lookout }): ReactNode {
  const h = look.y - look.groundY;
  // Six posts at the deck's corners, six rails joining their tops (no crossings).
  const R = 1.0;
  const posts = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        // At the hex corners (pointy-top: corners at +-z, like the cylinder's vertices).
        const a = (i / 6) * Math.PI * 2;
        return [Math.sin(a) * R, Math.cos(a) * R] as const;
      }),
    []
  );
  return (
    <group position={[look.x, look.groundY, look.z]}>
      <mesh position={[0, h / 2 - 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.04, h - 0.1, 6]} />
        <meshStandardMaterial color={STONE} flatShading roughness={0.95} />
      </mesh>
      <mesh position={[0, h - 0.07, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.08, 1.0, 0.14, 6]} />
        <meshStandardMaterial color={WOOD} flatShading roughness={0.9} />
      </mesh>
      {posts.map(([x, z], i) => (
        <mesh key={`p${i}`} position={[x, h + 0.24, z]} castShadow>
          <boxGeometry args={[0.07, 0.48, 0.07]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>
      ))}
      {posts.map(([x, z], i) => {
        const next = posts[(i + 1) % 6];
        if (!next) return null;
        const mx = (x + next[0]) / 2;
        const mz = (z + next[1]) / 2;
        const yaw = Math.atan2(next[0] - x, next[1] - z);
        return (
          <mesh
            key={`r${i}`}
            position={[mx, h + 0.46, mz]}
            rotation={[0, yaw, 0]}
            castShadow
          >
            <boxGeometry args={[0.06, 0.06, R]} />
            <meshStandardMaterial color={WOOD} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

/** All pads as three instanced meshes (stems, cushions, dots); a fired pad squashes. */
function Pads({
  pads,
  bounce,
  reducedMotion,
}: {
  pads: readonly JumpPad[];
  bounce: RefObject<PadBounce>;
  reducedMotion: boolean;
}): ReactNode {
  const stems = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const dots = useRef<THREE.InstancedMesh>(null);
  const DOTS = 5;
  const geo = useMemo(
    () => ({
      stem: new THREE.CylinderGeometry(0.3, 0.36, 0.22, 10),
      cap: new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      dot: new THREE.SphereGeometry(0.075, 6, 4),
    }),
    []
  );
  const mat = useMemo(
    () => ({
      stem: new THREE.MeshStandardMaterial({ color: STEM, flatShading: true }),
      cap: new THREE.MeshStandardMaterial({
        color: CUSHION,
        flatShading: true,
        roughness: 0.6,
      }),
      dot: new THREE.MeshStandardMaterial({ color: DOT, flatShading: true }),
    }),
    []
  );
  const settled = useRef(false);

  const place = (t: number): void => {
    const st = stems.current;
    const cp = caps.current;
    const dt = dots.current;
    if (!st || !cp || !dt) return;
    const b = bounce.current;
    pads.forEach((pad, i) => {
      const k = b && b.id === pad.id && !reducedMotion ? squash(t - b.at) : 1;
      // Return pads on the lookout decks are smaller cushions.
      const z = pad.kind === "return" ? 0.55 : 1;
      tmpQ.identity();
      tmpP.set(pad.x, pad.y + 0.11 * k * z, pad.z);
      tmpS.set(z, k * z, z);
      st.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      const capY = pad.y + 0.2 * k * z;
      const wide = (1 + (1 - k) * 0.4) * z;
      tmpP.set(pad.x, capY, pad.z);
      tmpS.set(wide, 0.55 * k * z, wide);
      cp.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      for (let d = 0; d < DOTS; d++) {
        const a = (d / DOTS) * Math.PI * 2 + i;
        const r = 0.3 * wide;
        // On the cushion's surface: sqrt(0.5^2 - 0.3^2) up, squashed like the cap.
        const lift = 0.4 * 0.55 * k * z;
        tmpP.set(pad.x + Math.cos(a) * r, capY + lift, pad.z + Math.sin(a) * r);
        tmpE.set(0, a, 0);
        tmpQ.setFromEuler(tmpE);
        tmpS.set(z, 0.55 * z, z);
        dt.setMatrixAt(i * DOTS + d, tmpM.compose(tmpP, tmpQ, tmpS));
      }
    });
    st.instanceMatrix.needsUpdate = true;
    cp.instanceMatrix.needsUpdate = true;
    dt.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    place(0);
    for (const m of [stems.current, caps.current, dots.current])
      m?.computeBoundingSphere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads]);

  useFrame(({ clock }) => {
    const b = bounce.current;
    if (!b) return;
    const age = clock.elapsedTime - b.at;
    if (age <= BOUNCE_TIME + 0.05) {
      settled.current = false;
      place(clock.elapsedTime);
    } else if (!settled.current) {
      settled.current = true;
      place(clock.elapsedTime);
    }
  });

  if (!pads.length) return null;
  return (
    <>
      <instancedMesh
        ref={stems}
        args={[geo.stem, mat.stem, pads.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={caps}
        args={[geo.cap, mat.cap, pads.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={dots}
        args={[geo.dot, mat.dot, pads.length * DOTS]}
        castShadow
      />
    </>
  );
}

const thermalVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const thermalFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float stripe = 0.5 + 0.5 * sin((vUv.x * 5.0 + vUv.y * 2.0 - uTime * 0.35) * 6.2831);
  float fade = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.6, 1.0, vUv.y));
  gl_FragColor = vec4(1.0, 0.98, 0.92, uOpacity * fade * (0.35 + 0.65 * stripe));
}
`;

/** Faint rising columns over the thermals, faded in only while gliding. */
function Thermals({
  thermals,
  reducedMotion,
}: {
  thermals: readonly Thermal[];
  reducedMotion: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(
    () => new THREE.CylinderGeometry(0.55, 1, 1, 14, 1, true),
    []
  );
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: thermalVertex,
        fragmentShader: thermalFragment,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  useFrame(({ clock }, dt) => {
    const u = mat.uniforms as {
      uTime: { value: number };
      uOpacity: { value: number };
    };
    const want = rtRef.current.move.mode === "glide" ? 0.16 : 0;
    const o = u.uOpacity.value;
    setUniform(u.uOpacity, o + (want - o) * (1 - Math.exp(-3 * dt)));
    if (!reducedMotion) setUniform(u.uTime, clock.elapsedTime);
    const g = group.current;
    if (g) g.visible = u.uOpacity.value > 0.004;
  });
  return (
    <group ref={group} visible={false}>
      {thermals.map((t, i) => {
        const height = 11;
        return (
          <mesh
            key={i}
            geometry={geo}
            material={mat}
            position={[t.x, t.ceiling - height / 2 - 1, t.z]}
            scale={[t.radius * 0.8, height, t.radius * 0.8]}
            renderOrder={2}
          />
        );
      })}
    </group>
  );
}

export function MovementProps({
  layout,
  bounce,
  reducedMotion,
}: {
  layout: MovementLayout;
  bounce: RefObject<PadBounce>;
  reducedMotion: boolean;
}): ReactNode {
  return (
    <group name="movement-props">
      {layout.launches.map((l) => (
        <LaunchPlatform key={l.id} spot={l} reducedMotion={reducedMotion} />
      ))}
      {layout.lookouts.map((l) => (
        <LookoutTower key={l.id} look={l} />
      ))}
      <Pads pads={layout.pads} bounce={bounce} reducedMotion={reducedMotion} />
      <Thermals thermals={layout.thermals} reducedMotion={reducedMotion} />
    </group>
  );
}
