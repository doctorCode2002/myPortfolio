"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

const FLOCKS = 3;
const PER_FLOCK = 6;
const N = FLOCKS * PER_FLOCK;

/** One wing: a thin triangle hinged at the body (x = 0), pointing along +x. */
function wingGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      // A swept gull wing: broad near the body, tapering to a tip behind the shoulder.
      [
        0, 0, 0.09, 0, 0, -0.07, 0.2, 0.02, 0.06, 0.2, 0.02, 0.06, 0, 0, -0.07,
        0.2, 0.02, -0.06, 0.2, 0.02, 0.06, 0.2, 0.02, -0.06, 0.36, 0.0, -0.12,
      ],
      3
    )
  );
  g.computeVertexNormals();
  return g;
}

/**
 * A few bird flocks circling the islands in V formations with flapping wings
 * (hidden under reduced motion).
 */
export function Birds({
  center,
  reducedMotion,
}: {
  center: { x: number; z: number };
  reducedMotion: boolean;
}): ReactNode {
  const left = useRef<THREE.InstancedMesh>(null);
  const right = useRef<THREE.InstancedMesh>(null);
  const body = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => wingGeometry(), []);
  const bodyGeo = useMemo(() => {
    const g = new THREE.OctahedronGeometry(1, 0);
    g.scale(0.055, 0.05, 0.2);
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: "#4f4a5e",
        side: THREE.DoubleSide,
      }),
    []
  );
  const flocks = useMemo(
    () =>
      Array.from({ length: FLOCKS }, (_, i) => ({
        // Wide, high orbits around the whole archipelago so the flocks read against the
        // sky instead of crossing the islands as dark shards.
        radius: 62 + i * 14,
        height: 16 + i * 4,
        speed: (0.07 + i * 0.02) * (i % 2 ? -1 : 1),
        phase: i * 2.1,
      })),
    []
  );
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(2.4, 2.4, 2.4),
    }),
    []
  );

  useFrame(({ clock }) => {
    const l = left.current;
    const r = right.current;
    if (!l || !r) return;
    const t = clock.elapsedTime;
    let i = 0;
    for (const f of flocks) {
      const a = f.phase + t * f.speed;
      const cx = center.x + Math.cos(a) * f.radius;
      const cz = center.z + Math.sin(a) * f.radius;
      // Heading: tangent of the circle.
      const heading = Math.atan2(
        -Math.sin(a) * Math.sign(f.speed),
        Math.cos(a) * Math.sign(f.speed)
      );
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      for (let b = 0; b < PER_FLOCK; b++) {
        const row = Math.ceil(b / 2);
        const side = b === 0 ? 0 : b % 2 ? -1 : 1;
        tmp.p.set(
          cx - fx * row * 2.0 + fz * side * row * 1.8,
          f.height + Math.sin(t * 1.3 + b) * 0.25,
          cz - fz * row * 2.0 - fx * side * row * 1.8
        );
        const flap = Math.sin(t * 9 + b * 0.7) * 0.6;
        tmp.e.set(0, heading, 0, "YXZ");
        body.current?.setMatrixAt(
          i,
          tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s)
        );
        tmp.e.set(0, heading, flap, "YXZ");
        l.setMatrixAt(
          i,
          tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s)
        );
        tmp.e.set(0, heading + Math.PI, flap, "YXZ");
        r.setMatrixAt(
          i,
          tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s)
        );
        i++;
      }
    }
    l.instanceMatrix.needsUpdate = true;
    if (body.current) body.current.instanceMatrix.needsUpdate = true;
    r.instanceMatrix.needsUpdate = true;
  });

  if (reducedMotion) return null;
  return (
    <>
      <instancedMesh ref={left} args={[geo, mat, N]} frustumCulled={false} />
      <instancedMesh ref={right} args={[geo, mat, N]} frustumCulled={false} />
      <instancedMesh
        ref={body}
        args={[bodyGeo, mat, N]}
        frustumCulled={false}
      />
    </>
  );
}
