"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { cellNodeId } from "../logic/pathfinding";
import { isCellWalkable } from "../logic/walk-grid";
import type { GameWorld } from "../logic/world-layout";
import { useRuntimeRef } from "../runtime";

/**
 * Dev-only walk grid overlay (?debug=1): green = walkable and on the nav graph, yellow =
 * walkable but closed for paths (a prop on the hex), red = blocked / water. Obstacles are
 * outlined, bridge corridors and the current click-to-move path are drawn as lines.
 */
export function WalkGridViz({ world }: { world: GameWorld }): ReactNode {
  const rtRef = useRuntimeRef();
  const ref = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(
    () =>
      world.walk.islands.flatMap((g) =>
        [...g.cells.values()].map((c) => ({ c, g }))
      ),
    [world]
  );
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(world.size * 0.86, 6, Math.PI / 6);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [world.size]);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    cells.forEach(({ c, g }, i) => {
      m.makeTranslation(c.x, c.y + 0.04, c.z);
      mesh.setMatrixAt(i, m);
      const onGraph = world.nav.nodes.has(cellNodeId(g.islandId, c.q, c.r));
      col.set(!isCellWalkable(c) ? "#e5484d" : onGraph ? "#46a758" : "#f5d90a");
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cells, world]);

  const lines = useMemo(() => {
    const pts: number[] = [];
    const seg = (a: THREE.Vector3, b: THREE.Vector3): void => {
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    };
    for (const g of world.walk.islands) {
      const y = g.baseY + 0.08;
      for (const o of g.obstacles) {
        if (o.shape === "circle") {
          for (let i = 0; i < 12; i++) {
            const a0 = (i / 12) * Math.PI * 2;
            const a1 = ((i + 1) / 12) * Math.PI * 2;
            seg(
              new THREE.Vector3(
                o.x + Math.cos(a0) * o.radius,
                y,
                o.z + Math.sin(a0) * o.radius
              ),
              new THREE.Vector3(
                o.x + Math.cos(a1) * o.radius,
                y,
                o.z + Math.sin(a1) * o.radius
              )
            );
          }
        } else {
          const c = Math.cos(o.rot);
          const s = Math.sin(o.rot);
          const corner = (lx: number, lz: number): THREE.Vector3 =>
            new THREE.Vector3(o.x + c * lx + s * lz, y, o.z - s * lx + c * lz);
          const k = [
            corner(-o.hx, -o.hz),
            corner(o.hx, -o.hz),
            corner(o.hx, o.hz),
            corner(-o.hx, o.hz),
          ];
          for (let i = 0; i < 4; i++)
            seg(k[i] as THREE.Vector3, k[(i + 1) % 4] as THREE.Vector3);
        }
      }
    }
    for (const b of world.walk.bridges) {
      const dx = b.b.x - b.a.x;
      const dz = b.b.z - b.a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * b.halfWidth;
      const nz = (dx / len) * b.halfWidth;
      for (const side of [-1, 1]) {
        seg(
          new THREE.Vector3(b.a.x + nx * side, b.a.y + 0.1, b.a.z + nz * side),
          new THREE.Vector3(b.b.x + nx * side, b.b.y + 0.1, b.b.z + nz * side)
        );
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [world]);

  const pathLine = useRef<THREE.Line>(null);
  const pathGeo = useMemo(() => new THREE.BufferGeometry(), []);
  const pathObj = useMemo(
    () =>
      new THREE.Line(
        pathGeo,
        new THREE.LineBasicMaterial({ color: "#00e5ff" })
      ),
    [pathGeo]
  );
  useFrame(() => {
    const rt = rtRef.current;
    const path = rt.path;
    const line = pathLine.current;
    if (!line) return;
    line.visible = Boolean(path && path.length > 0);
    if (!path || path.length === 0) return;
    const p = rt.player.pos;
    const arr = [
      p.x,
      p.y + 0.15,
      p.z,
      ...path.flatMap((w) => [w.x, w.y + 0.15, w.z]),
    ];
    pathGeo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  });

  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[geo, mat, cells.length]}
        renderOrder={5}
        frustumCulled={false}
      />
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#ffffff" toneMapped={false} />
      </lineSegments>
      <primitive object={pathObj} ref={pathLine} />
    </group>
  );
}
