"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { mayorModelFor } from "../assets/characters";
import { angleDelta, damp } from "../logic/camera-math";
import type { Manifest } from "../logic/types";
import type { Interactable } from "../logic/world-layout";
import { islandBob, useRuntimeRef } from "../runtime";
import { CharacterModel, type AnimState } from "./character-model";

/** An island mayor: idles at spawns.mayor and turns to face the player when they come close. */
export function Mayor({
  npc,
  manifest,
  restHeading,
}: {
  npc: Interactable;
  manifest: Manifest | null;
  restHeading: number;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const group = useRef<THREE.Group>(null);
  const anim = useRef<AnimState>({ anim: "idle", speed: 0 });
  const heading = useRef(restHeading);
  const modelName = useMemo(
    () => mayorModelFor(manifest, npc.id, npc.charSheet ?? "char_0"),
    [manifest, npc]
  );

  useFrame(({ clock }, rawDt) => {
    const rt = rtRef.current;
    const dt = Math.min(rawDt, 0.05);
    const p = rt.player.pos;
    const d = Math.hypot(p.x - npc.x, p.z - npc.z);
    const want =
      d < npc.range * 2 ? Math.atan2(p.x - npc.x, p.z - npc.z) : restHeading;
    heading.current += angleDelta(heading.current, want) * damp(5, dt);
    const g = group.current;
    if (g) {
      g.position.set(
        npc.x,
        npc.y + islandBob(npc.islandId, clock.elapsedTime, rt.reducedMotion),
        npc.z
      );
      g.rotation.y = heading.current;
    }
  });

  return (
    <group ref={group} name={npc.id}>
      <CharacterModel
        manifest={manifest}
        name={modelName}
        color="#c98b4f"
        state={anim}
      />
    </group>
  );
}
