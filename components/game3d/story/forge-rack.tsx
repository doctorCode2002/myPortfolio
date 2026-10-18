"use client";

import { Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

import { gameEvents } from "@/components/game/engine/events";
import { STACK_CHIPS } from "@/lib/content/about";
import { FORGE_RACK } from "@/lib/content/tours";
import type { BoxObstacle } from "../logic/walk-grid";
import type { GameWorld, Interactable } from "../logic/world-layout";
import { useRuntimeRef } from "../runtime";
import { setPromptLift } from "./registry";
import { rackSlots } from "./rack-layout";

const POST_X = 0.86;
const SHELVES = [0.42, 0.92] as const;
const HEIGHT = 1.32;
const DEPTH = 0.34;
/** Show the nearest ingot's name when the player is this close to the rack. */
const LABEL_RADIUS = 3.2;

/** One shared ingot mesh: a square frustum turned 45 degrees and stretched into a bar. */
function ingotGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.075, 0.105, 0.085, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(1.55, 1, 0.85);
  g.translate(0, 0.0425, 0);
  return g;
}

function brighten(hex: string, k: number): THREE.Color {
  const c = new THREE.Color(hex);
  return c.lerp(new THREE.Color("#ffffff"), k);
}

/**
 * The tech stack at the home forge: a wooden rack (two posts and two shelves, nothing
 * crossing) holding one glowing ingot per technology from the site's stack data. The
 * nearest ingot is labelled as the player walks along it, any ingot on hover, and E (or
 * a click) opens the stack panel.
 */
export function ForgeRack({
  world,
  reducedMotion,
  rtl,
}: {
  world: GameWorld;
  reducedMotion: boolean;
  rtl: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const grid = world.walk.islands.find(
    (g) => g.islandId === FORGE_RACK.islandId
  );
  const cell = grid?.cells.get(`${FORGE_RACK.at.q},${FORGE_RACK.at.r}`);
  const rot = (FORGE_RACK.rot * Math.PI) / 180;
  const x = (cell?.x ?? 0) + FORGE_RACK.offset[0];
  const z = (cell?.z ?? 0) + FORGE_RACK.offset[1];
  const y = cell?.y ?? 0;
  const slots = useMemo(
    () => rackSlots(STACK_CHIPS.length, SHELVES, POST_X),
    []
  );
  const geometry = useMemo(() => ingotGeometry(), []);
  const materials = useMemo(
    () =>
      STACK_CHIPS.map(
        (chip) =>
          new THREE.MeshStandardMaterial({
            color: brighten(chip.bg, 0.25),
            emissive: new THREE.Color(chip.bg),
            emissiveIntensity: 0.9,
            metalness: 0.55,
            roughness: 0.35,
          })
      ),
    []
  );
  const [label, setLabel] = useState<number | null>(null);
  const hovered = useRef<number | null>(null);
  const shown = useRef<number | null>(null);

  useEffect(
    () => () => {
      geometry.dispose();
      for (const m of materials) m.dispose();
    },
    [geometry, materials]
  );

  // A collider for the rack, and the E prompt in front of it (opens the stack panel).
  useEffect(() => {
    if (!grid || !cell) return;
    const box: BoxObstacle = {
      shape: "box",
      x,
      z,
      hx: POST_X + 0.08,
      hz: DEPTH / 2 + 0.04,
      rot,
      source: "forge-rack",
    };
    const front: Interactable = {
      kind: "door",
      id: FORGE_RACK.buildingId,
      islandId: FORGE_RACK.islandId,
      x: x + Math.sin(rot) * 0.95,
      y,
      z: z + Math.cos(rot) * 0.95,
      range: 1.6,
      q: FORGE_RACK.at.q,
      r: FORGE_RACK.at.r,
    };
    setPromptLift(front, 2.05);
    grid.obstacles.push(box);
    world.interactables.push(front);
    return () => {
      const i = grid.obstacles.indexOf(box);
      if (i >= 0) grid.obstacles.splice(i, 1);
      const j = world.interactables.indexOf(front);
      if (j >= 0) world.interactables.splice(j, 1);
    };
  }, [world, grid, cell, x, y, z, rot]);

  useFrame(({ clock }) => {
    const p = rtRef.current.player.pos;
    // Nearest ingot to the player, in the rack's local frame.
    let next = hovered.current;
    if (next === null && Math.hypot(p.x - x, p.z - z) < LABEL_RADIUS) {
      const dx = p.x - x;
      const dz = p.z - z;
      const lx = Math.cos(rot) * dx - Math.sin(rot) * dz;
      let best = Infinity;
      slots.forEach((s, i) => {
        const d = Math.abs(s.x - lx);
        if (d < best) {
          best = d;
          next = i;
        }
      });
    }
    if (next !== shown.current) {
      shown.current = next;
      setLabel(next);
    }
    if (!reducedMotion) {
      const t = clock.elapsedTime;
      materials.forEach((m, i) => {
        m.emissiveIntensity =
          (i === shown.current ? 1.6 : 0.85) +
          Math.sin(t * 1.3 + i * 0.9) * 0.12;
      });
    } else {
      materials.forEach((m, i) => {
        m.emissiveIntensity = i === shown.current ? 1.6 : 0.9;
      });
    }
  });

  if (!cell) return null;

  const open = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    const rt = rtRef.current;
    if (
      rt.frozen ||
      rt.car.driving ||
      rt.move.mode !== "walk" ||
      gameEvents.isUiLocked()
    )
      return;
    rt.path = null;
    rt.target = null;
    gameEvents.emit("interact:building", { buildingId: FORGE_RACK.buildingId });
  };
  const chip = label !== null ? STACK_CHIPS[label] : undefined;
  const slot = label !== null ? slots[label] : undefined;
  const wood = "#7a5236";

  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]} name="forge-rack">
      {[-POST_X, POST_X].map((px) => (
        <mesh key={px} position={[px, HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[0.09, HEIGHT, DEPTH]} />
          <meshStandardMaterial color={wood} roughness={0.85} />
        </mesh>
      ))}
      {SHELVES.map((sy) => (
        <mesh key={sy} position={[0, sy - 0.025, 0]} castShadow receiveShadow>
          <boxGeometry args={[POST_X * 2 - 0.09, 0.05, DEPTH - 0.04]} />
          <meshStandardMaterial color="#8d6242" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, -DEPTH / 2 + 0.02]} receiveShadow>
        <boxGeometry args={[POST_X * 2 - 0.09, 0.12, 0.04]} />
        <meshStandardMaterial color={wood} roughness={0.85} />
      </mesh>
      {slots.map((s, i) => (
        <mesh
          key={STACK_CHIPS[i]?.id ?? i}
          geometry={geometry}
          material={materials[i] as THREE.MeshStandardMaterial}
          position={[s.x, s.y, 0.02]}
          rotation={[0, s.tilt, 0]}
          castShadow
          onClick={open}
          onPointerOver={(e) => {
            e.stopPropagation();
            hovered.current = i;
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            if (hovered.current === i) hovered.current = null;
            document.body.style.cursor = "";
          }}
        />
      ))}
      {chip && slot ? (
        <Html
          position={[slot.x, slot.y + 0.28, 0.05]}
          center
          zIndexRange={[33, 30]}
          style={{ pointerEvents: "none" }}
        >
          <span
            dir={rtl ? "rtl" : "ltr"}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shadow-lg"
            style={{ background: chip.bg, color: chip.fg }}
            data-forge-label={chip.id}
          >
            {chip.label}
          </span>
        </Html>
      ) : null}
    </group>
  );
}
