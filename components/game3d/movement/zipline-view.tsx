"use client";

/**
 * Ziplines, drawn in code: a timber post with a short arm at each end (a "Γ", no cross),
 * the sagging cable as a thin tube, and a pulley handle (a wheel and a T-shaped grip) that
 * waits at the start post and rides along with the player.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";

import type { Point3 } from "../logic/jump-arc";
import {
  cablePoint,
  ZIP_HANG,
  type Zipline,
  type ZipState,
} from "../logic/zipline";

const POST = "#7a4f2b";
const CABLE = "#4a4440";
const METAL = "#c9c2b8";
const GRIP = "#d9573f";
const POST_OFFSET = 0.7;

function Post({
  at,
  top,
  toward,
}: {
  at: Point3;
  top: number;
  /** Plan-view direction from the post to the cable end it holds. */
  toward: { x: number; z: number };
}): ReactNode {
  const h = top - at.y + 0.15;
  const yaw = Math.atan2(toward.x, toward.z);
  return (
    <group position={[at.x, at.y, at.z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, h, 6]} />
        <meshStandardMaterial color={POST} flatShading />
      </mesh>
      {/* The arm reaches from the post's top out to the cable end. */}
      <mesh position={[0, h - 0.08, POST_OFFSET / 2]} castShadow>
        <boxGeometry args={[0.1, 0.1, POST_OFFSET + 0.1]} />
        <meshStandardMaterial color={POST} flatShading />
      </mesh>
    </group>
  );
}

function Line({ line }: { line: Zipline }): ReactNode {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i <= 24; i++) {
      cablePoint(line, i / 24, p);
      pts.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts),
      48,
      0.022,
      5,
      false
    );
  }, [line]);
  const dx = line.b.x - line.a.x;
  const dz = line.b.z - line.a.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  return (
    <group name={`zipline-${line.id}`}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={CABLE} roughness={0.6} />
      </mesh>
      <Post
        at={{
          x: line.a.x - ux * POST_OFFSET,
          y: line.start.y,
          z: line.a.z - uz * POST_OFFSET,
        }}
        top={line.a.y}
        toward={{ x: ux, z: uz }}
      />
      <Post
        at={{
          x: line.b.x + ux * POST_OFFSET,
          y: line.end.y,
          z: line.b.z + uz * POST_OFFSET,
        }}
        top={line.b.y}
        toward={{ x: -ux, z: -uz }}
      />
    </group>
  );
}

export function ZipLines({ lines }: { lines: readonly Zipline[] }): ReactNode {
  return (
    <>
      {lines.map((l) => (
        <Line key={l.id} line={l} />
      ))}
    </>
  );
}

/** The pulley handles: parked at their start, or riding with the player. */
export function ZipHandle({
  lines,
  ride,
}: {
  lines: readonly Zipline[];
  ride: RefObject<(ZipState & { grab: number }) | null>;
}): ReactNode {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const p = useRef<Point3>({ x: 0, y: 0, z: 0 });
  useFrame(() => {
    const r = ride.current;
    lines.forEach((line, i) => {
      const g = groups.current[i];
      if (!g) return;
      const t = r && r.line.id === line.id ? r.t : 0;
      cablePoint(line, t, p.current);
      g.position.set(p.current.x, p.current.y, p.current.z);
      g.rotation.y = Math.atan2(line.b.x - line.a.x, line.b.z - line.a.z);
    });
  });
  return (
    <>
      {lines.map((line, i) => (
        <group
          key={line.id}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          {/* Pulley wheel on the cable. */}
          <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[0.07, 0.025, 6, 12]} />
            <meshStandardMaterial color={METAL} metalness={0.4} />
          </mesh>
          {/* Hanger and the grip bar across its foot (an upside-down T). */}
          <mesh position={[0, -ZIP_HANG / 2 - 0.05, 0]}>
            <cylinderGeometry args={[0.015, 0.015, ZIP_HANG, 5]} />
            <meshStandardMaterial color={METAL} />
          </mesh>
          <mesh
            position={[0, -ZIP_HANG - 0.05, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.03, 0.03, 0.42, 6]} />
            <meshStandardMaterial color={GRIP} flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}
