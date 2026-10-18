"use client";

import type { ReactNode } from "react";

import { STACK_CHIPS } from "@/lib/content/about";
import { PROJECTS } from "@/lib/content/projects";
import { STORY_LIST } from "@/lib/content/tours";
import type { GameWorld } from "../logic/world-layout";
import { ForgeRack } from "./forge-rack";
import type { StoryLabels } from "./labels";
import { ProjectWindow } from "./project-window";

/** Glow colour per project window (matches each island's mood). */
const ACCENTS: Record<string, string> = {
  khidmty: "#ffcf7a",
  civicmind: "#8fd8ff",
  onyx: "#ffc46b",
  saleh: "#ff9d5c",
  eyad: "#ffb3d1",
};

/** Screenshots per window (stable arrays, so the textures load once). */
const IMAGES: Record<string, readonly string[]> = Object.fromEntries(
  STORY_LIST.map((story) => {
    const project = PROJECTS.find((p) => p.id === story.islandId);
    return [
      story.islandId,
      story.window.images ?? (project ? [project.image] : []),
    ];
  })
);

/**
 * The islands' stories in the world: a live project window by each portal and the tech
 * rack at the home forge. (The mayors' routes and tours live in entities/mayor.tsx.)
 */
export function StoryLayer({
  world,
  labels,
  reducedMotion,
  rtl,
}: {
  world: GameWorld;
  labels: StoryLabels;
  reducedMotion: boolean;
  rtl: boolean;
}): ReactNode {
  const hasHome = world.islands.some((i) => i.id === "home");
  return (
    <>
      {STORY_LIST.map((story) => {
        if (!world.islands.some((i) => i.id === story.islandId)) return null;
        return (
          <ProjectWindow
            key={story.islandId}
            world={world}
            story={story}
            images={IMAGES[story.islandId] ?? []}
            accent={ACCENTS[story.islandId] ?? "#ffd38a"}
            labels={labels}
            reducedMotion={reducedMotion}
          />
        );
      })}
      {hasHome && STACK_CHIPS.length > 0 ? (
        <ForgeRack world={world} reducedMotion={reducedMotion} rtl={rtl} />
      ) : null}
    </>
  );
}
