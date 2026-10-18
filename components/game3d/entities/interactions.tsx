"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { gameEvents } from "@/components/game/engine/events";
import {
  nearestInteractable,
  type GameWorld,
  type Interactable,
} from "../logic/world-layout";
import { useRuntimeRef } from "../runtime";

export type PromptLabels = {
  /** Sign text per building id (dict.world.buildings[id].sign). */
  signs: Record<string, string>;
  /** Display name per mayor id. */
  npcNames: Record<string, string>;
  talk: string;
  tap: string;
  /** Vehicle prompt ("Drive"). */
  drive: string;
  rtl: boolean;
};

/** Keys repeat and the overlays close on the same E / Space press; ignore presses right after unfreezing. */
const REOPEN_GUARD_MS = 300;

export function emitInteraction(item: Interactable): void {
  if (item.kind === "vehicle") return;
  if (item.kind === "door") {
    gameEvents.emit("interact:building", { buildingId: item.id });
  } else {
    gameEvents.emit("interact:npc", {
      npcId: item.id,
      charSheet: item.charSheet ?? "char_0",
    });
  }
}

/** The sign's short title: the part before an em dash, if any. */
function shortSign(text: string): { title: string; detail: string } {
  const [title, ...rest] = text.split(" — ");
  return { title: title ?? text, detail: rest.join(" — ") };
}

/**
 * Tracks the nearest door / NPC in range, shows a world-space prompt ("E" + the localised
 * sign text or "Talk"), and opens it on E, Space or a tap. Nothing opens automatically.
 */
export function Interactions({
  world,
  labels,
  touch,
}: {
  world: GameWorld;
  labels: PromptLabels;
  touch: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const [nearest, setNearest] = useState<Interactable | null>(null);

  const open = useCallback((): void => {
    const rt = rtRef.current;
    const item = rt.nearest;
    if (!item || rt.frozen || gameEvents.isUiLocked()) return;
    if (performance.now() - rt.unfrozenAt < REOPEN_GUARD_MS) return;
    rt.path = null;
    rt.target = null;
    if (item.kind === "vehicle") rt.car.request = "enter";
    else emitInteraction(item);
  }, [rtRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const rt = rtRef.current;
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.code === "KeyE" || e.code === "Space") {
        if (rt.nearest && !rt.frozen && !gameEvents.isUiLocked()) {
          e.preventDefault();
          open();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rtRef]);

  useFrame(() => {
    const rt = rtRef.current;
    const p = rt.player.pos;
    const hit =
      rt.frozen || rt.car.driving
        ? null
        : nearestInteractable(world.interactables, p.x, p.y, p.z);
    const item = hit?.item ?? null;
    if (item !== rt.nearest) {
      rt.nearest = item;
      setNearest(item);
    }
  });

  if (!nearest) return null;
  const isDoor = nearest.kind === "door";
  const isVehicle = nearest.kind === "vehicle";
  const sign = isDoor
    ? shortSign(labels.signs[nearest.id] ?? nearest.id)
    : null;
  const title = isVehicle
    ? labels.drive
    : isDoor
      ? (sign?.title ?? nearest.id)
      : (labels.npcNames[nearest.id] ?? labels.talk);
  const action = isVehicle ? undefined : isDoor ? sign?.detail : labels.talk;
  const y = nearest.y + (isDoor ? 1.6 : isVehicle ? 1.3 : 1.45);

  return (
    <Html
      position={[nearest.x, y, nearest.z]}
      center
      zIndexRange={[35, 30]}
      style={{ pointerEvents: "none" }}
    >
      <button
        type="button"
        dir={labels.rtl ? "rtl" : "ltr"}
        onClick={open}
        onPointerDown={(e) => e.stopPropagation()}
        className="border-foreground/15 bg-background/90 text-foreground pointer-events-auto flex max-w-[16rem] cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-start text-xs font-medium whitespace-nowrap shadow-lg backdrop-blur-md transition-transform duration-150 hover:scale-105 sm:text-sm"
        data-game3d-prompt={nearest.id}
      >
        <kbd className="bg-accent text-background flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold">
          {touch ? labels.tap : "E"}
        </kbd>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold">{title}</span>
          {action ? (
            <span className="text-muted-foreground truncate text-[11px]">
              {action}
            </span>
          ) : null}
        </span>
      </button>
    </Html>
  );
}
