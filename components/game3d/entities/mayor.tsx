"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

import { gameEvents } from "@/components/game/engine/events";
import { storyForMayor } from "@/lib/content/tours";
import { mayorModelFor } from "../assets/characters";
import { angleDelta, damp } from "../logic/camera-math";
import type { Manifest } from "../logic/types";
import { surfaceAt, type Vec3 } from "../logic/walk-world";
import type { GameWorld, Interactable } from "../logic/world-layout";
import { islandBob, useRuntimeRef } from "../runtime";
import {
  cancelTour,
  createBrain,
  startTour,
  stepBrain,
  type BrainEnv,
  type BubbleKind,
} from "../story/mayor-brain";
import { setTourOffer } from "../story/registry";
import {
  mayorObstacle,
  planMayorPath,
  spotToWorld,
  syncMayor,
} from "../story/routes";
import { TourBubble } from "../story/tour-bubble";
import { CharacterModel, type AnimState } from "./character-model";
import type { PromptLabels } from "./interactions";

/** While the dialogue is open, a mayor this close to the player stops to listen. */
const LISTEN_RADIUS = 3.5;

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h;
}

/**
 * An island mayor: walks a short route near their building (pausing and idling at each
 * waypoint), waves when the player comes close, faces them while talking, and gives a
 * guided tour after the dialogue's "Want a tour?" (see story/mayor-brain.ts).
 */
export function Mayor({
  npc,
  manifest,
  restHeading,
  world,
  labels,
}: {
  npc: Interactable;
  manifest: Manifest | null;
  restHeading: number;
  world?: GameWorld;
  labels?: PromptLabels;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const group = useRef<THREE.Group>(null);
  const anim = useRef<AnimState>({ anim: "idle", speed: 0 });
  const heading = useRef(restHeading);
  const modelName = useMemo(
    () => mayorModelFor(manifest, npc.id, npc.charSheet ?? "char_0"),
    [manifest, npc]
  );
  const story = storyForMayor(npc.id);
  const brain = useRef(
    createBrain({ x: npc.x, y: npc.y, z: npc.z }, restHeading, seedOf(npc.id))
  );
  const baseRange = useRef(npc.range);
  const [bubble, setBubble] = useState<{
    kind: BubbleKind;
    stop: number;
  } | null>(null);
  const shown = useRef<{ kind: BubbleKind | null; stop: number }>({
    kind: null,
    stop: 0,
  });

  const env = useMemo((): BrainEnv | null => {
    if (!world || !story) return null;
    const self = mayorObstacle(world.walk, npc.islandId, npc.id);
    const points = (spots: readonly { q: number; r: number }[]): Vec3[] =>
      spots.flatMap((s) => {
        const p = spotToWorld(world, npc.islandId, s);
        return p ? [p] : [];
      });
    return {
      route: points(story.route),
      routeMode: story.routeMode,
      stops: points(story.tour.map((t) => t.stand)),
      restHeading,
      plan: (from, to) => planMayorPath(world, self, from, to),
      groundY: (x, z, nearY) => surfaceAt(world.walk, x, z, nearY)?.y ?? null,
    };
  }, [world, story, npc.islandId, npc.id, restHeading]);
  const self = useMemo(
    () => (world ? mayorObstacle(world.walk, npc.islandId, npc.id) : null),
    [world, npc.islandId, npc.id]
  );

  // Tour offers and answers (the dialogue's last line, see play-view).
  useEffect(() => {
    if (!env || env.stops.length < 2) return;
    setTourOffer(npc.id, brain.current.mode !== "tour");
    const off = gameEvents.on("tour:answer", ({ npcId, accept }) => {
      if (npcId !== npc.id || !accept) return;
      startTour(brain.current, env);
    });
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== "Escape" || brain.current.mode !== "tour") return;
      if (gameEvents.isUiLocked()) return;
      e.preventDefault();
      cancelTour(brain.current, env);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      off();
      window.removeEventListener("keydown", onKey);
      setTourOffer(npc.id, false);
    };
  }, [env, npc.id]);

  useFrame(({ clock }, rawDt) => {
    const rt = rtRef.current;
    const dt = Math.min(rawDt, 0.05);
    const b = brain.current;
    const p = rt.player.pos;
    if (env) {
      const dp = Math.hypot(p.x - b.pos.x, p.z - b.pos.z);
      stepBrain(b, env, {
        dt,
        player: p,
        playerActive: !rt.frozen && !rt.car.driving,
        talking: rt.frozen && dp < LISTEN_RADIUS,
      });
      // The collider, the talk prompt and the tour offer follow the mayor.
      const touring = b.mode === "tour";
      syncMayor(npc, self, b.pos, touring ? 0 : baseRange.current);
      if (env.stops.length >= 2) setTourOffer(npc.id, !touring);
      anim.current.anim = b.anim;
      anim.current.speed = b.speed;
      heading.current += angleDelta(heading.current, b.heading) * damp(7, dt);
      const kind = touring ? b.bubble : null;
      const last = shown.current;
      if (kind !== last.kind || (kind && last.stop !== b.stop)) {
        last.kind = kind;
        last.stop = b.stop;
        setBubble(kind ? { kind, stop: b.stop } : null);
      }
    } else {
      const d = Math.hypot(p.x - npc.x, p.z - npc.z);
      const want =
        d < npc.range * 2 ? Math.atan2(p.x - npc.x, p.z - npc.z) : restHeading;
      heading.current += angleDelta(heading.current, want) * damp(5, dt);
    }
    const g = group.current;
    if (g) {
      g.position.set(
        b.pos.x,
        b.pos.y + islandBob(npc.islandId, clock.elapsedTime, rt.reducedMotion),
        b.pos.z
      );
      g.rotation.y = heading.current;
    }
  });

  const stop = bubble && story ? story.tour[bubble.stop] : undefined;
  const narrated = Boolean(labels?.story?.narratedMayors.has(npc.id));
  return (
    <group ref={group} name={npc.id}>
      <CharacterModel
        manifest={manifest}
        name={modelName}
        color="#c98b4f"
        state={anim}
      />
      {bubble && story && labels?.story && env ? (
        <TourBubble
          kind={bubble.kind}
          stop={bubble.stop}
          total={story.tour.length}
          // Real clients never speak invented lines: their stops are narration.
          voice={
            bubble.kind === "stop" && stop && !narrated
              ? stop.voice
              : "narrator"
          }
          text={
            bubble.kind === "stop" && stop
              ? (labels.story.lines[story.islandId]?.[stop.id] ?? "")
              : bubble.kind === "done"
                ? labels.story.done
                : labels.story.follow.replace(
                    "{name}",
                    labels.npcNames[npc.id] ?? ""
                  )
          }
          labels={labels.story}
          rtl={labels.rtl}
          onEnd={() => cancelTour(brain.current, env)}
        />
      ) : null}
    </group>
  );
}
