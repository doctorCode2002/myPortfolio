"use client";

import { useLayoutEffect, useMemo, type ReactNode } from "react";

import type { CircleObstacle } from "../logic/walk-grid";
import type { GameWorld, Interactable } from "../logic/world-layout";
import { GUESTBOOK_STONE_ID, pickStoneCell } from "./stone-layout";

const STONE = "#b9b2a3";
const STONE_DARK = "#8f8878";
const SLATE = "#6f7d86";
const INSCRIPTION = "#3e474d";

/**
 * The guestbook stone on the home plaza: a slate tablet on a stone plinth (procedural, a
 * handful of boxes). It registers itself as an interactable (E opens the guestbook) and as
 * a small obstacle, and removes both when unmounted.
 */
export function GuestbookStone({ world }: { world: GameWorld }): ReactNode {
  const spot = useMemo(() => {
    const grid = world.walk.islands.find((g) => g.islandId === "home");
    const cell = grid ? pickStoneCell(grid) : null;
    return grid && cell ? { grid, cell } : null;
  }, [world]);

  useLayoutEffect(() => {
    if (!spot) return;
    const { grid, cell } = spot;
    const item: Interactable = {
      kind: "door",
      id: GUESTBOOK_STONE_ID,
      islandId: "home",
      x: cell.x,
      y: cell.y,
      z: cell.z,
      range: 0.85 * world.hexWidth,
      q: cell.q,
      r: cell.r,
    };
    const obstacle: CircleObstacle = {
      shape: "circle",
      x: cell.x,
      z: cell.z,
      radius: 0.34,
      source: GUESTBOOK_STONE_ID,
    };
    world.interactables.push(item);
    grid.obstacles.push(obstacle);
    return () => {
      const i = world.interactables.indexOf(item);
      if (i >= 0) world.interactables.splice(i, 1);
      const j = grid.obstacles.indexOf(obstacle);
      if (j >= 0) grid.obstacles.splice(j, 1);
    };
  }, [spot, world]);

  if (!spot) return null;
  const { cell } = spot;
  // Face the plaza centre (the fountain at the island origin).
  const face = Math.atan2(
    spot.grid.origin.x - cell.x,
    spot.grid.origin.z - cell.z
  );
  return (
    <group
      position={[cell.x, cell.y, cell.z]}
      rotation={[0, face, 0]}
      name="guestbook-stone"
    >
      {/* Plinth: a wide foot and a narrower block. */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.12, 0.5]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.27, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.56, 0.3, 0.38]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      {/* The tablet, leaning back a little. */}
      <group position={[0, 0.42, 0.02]} rotation={[-0.18, 0, 0]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.5, 0.6, 0.09]} />
          <meshStandardMaterial color={SLATE} roughness={0.75} />
        </mesh>
        {/* Rounded top: a half disc (axis along z, upper half). */}
        <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry
            args={[0.25, 0.25, 0.09, 16, 1, false, Math.PI / 2, Math.PI]}
          />
          <meshStandardMaterial color={SLATE} roughness={0.75} />
        </mesh>
        {/* Inscription lines (horizontal only). */}
        {[0.52, 0.42, 0.32, 0.22].map((y, i) => (
          <mesh key={y} position={[0, y, 0.047]}>
            <boxGeometry args={[i === 0 ? 0.24 : 0.34, 0.025, 0.005]} />
            <meshStandardMaterial color={INSCRIPTION} roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
