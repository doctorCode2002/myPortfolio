/**
 * Localised strings for the island stories (tour bubbles, project windows, the forge
 * rack), read from `dict.world.tours` and the project titles.
 */

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PROJECTS } from "@/lib/content/projects";
import { ISLANDS, RESIDENTS } from "@/lib/content/world";

type Tours = Dictionary["world"]["tours"];

export type StoryLabels = {
  narrator: string;
  demo: string;
  /** "Follow {name} to the next stop." */
  follow: string;
  /** "Stop {n} of {total}" */
  progress: string;
  done: string;
  end: string;
  escHint: string;
  screen: string;
  screenUnavailable: string;
  nextImage: string;
  prevImage: string;
  rack: string;
  /** Tour stop lines: islandId -> stopId -> text. */
  lines: Record<string, Record<string, string>>;
  /** Project titles by project / island id. */
  titles: Record<string, string>;
  /** Mayors linked to a real testimonial (narrator voice only). */
  narratedMayors: ReadonlySet<string>;
};

export function buildStoryLabels(dict: Dictionary): StoryLabels {
  const t: Tours = dict.world.tours;
  const lines: Record<string, Record<string, string>> = {};
  for (const p of PROJECTS) {
    const entry = (t as unknown as Record<string, unknown>)[p.id];
    if (entry && typeof entry === "object")
      lines[p.id] = entry as Record<string, string>;
  }
  const items = dict.projects.items as Record<string, { title?: string }>;
  const titles: Record<string, string> = {};
  for (const p of PROJECTS) titles[p.id] = items[p.id]?.title ?? p.id;
  return {
    narrator: t.narrator,
    demo: t.demo,
    follow: t.follow,
    progress: t.progress,
    done: t.done,
    end: t.end,
    escHint: t.escHint,
    screen: t.screen,
    screenUnavailable: t.screenUnavailable,
    nextImage: t.nextImage,
    prevImage: t.prevImage,
    rack: t.rack,
    lines,
    titles,
    narratedMayors: new Set([
      ...ISLANDS.flatMap((i) =>
        i.mayor?.testimonialId || i.mayor?.real ? [i.mayor.id] : []
      ),
      ...RESIDENTS.filter((r) => r.real).map((r) => r.id),
    ]),
  };
}
