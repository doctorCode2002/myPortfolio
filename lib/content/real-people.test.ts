/**
 * Real people on the islands are never given invented words: every mayor marked `real`
 * (a real person without a testimonial, e.g. Bahaa on Khidmty, Wejdan on WACO) speaks
 * only neutral narrator lines in both languages, and every mayor tied to a real person
 * (real or with a testimonial) gets narrator-only tour stops.
 */

import { describe, expect, it } from "vitest";

import ar from "@/app/dictionaries/ar.json";
import en from "@/app/dictionaries/en.json";

import { storyForIsland } from "./tours";
import { ISLANDS } from "./world";

const mayors = ISLANDS.flatMap((i) =>
  i.mayor ? [{ islandId: i.id, mayor: i.mayor }] : []
);
const realMayors = mayors.filter((m) => m.mayor.real);
const dictMayors = (d: typeof en | typeof ar) =>
  d.world.mayors as unknown as Record<
    string,
    { name?: string; title?: string; lines: string[] } | undefined
  >;

describe("real people", () => {
  it("includes Khidmty's founder", () => {
    expect(realMayors.map((m) => m.mayor.id)).toContain("mayor_khidmty");
  });

  it.each(realMayors.map((m) => [m.mayor.id, m] as const))(
    "%s is real, not demo, and only narrated in en and ar",
    (id, { mayor }) => {
      expect(mayor.demo).toBeFalsy();
      for (const [dict, prefix] of [
        [en, /^Narrator: /],
        [ar, /^الراوي: /],
      ] as const) {
        const m = dictMayors(dict)[id];
        expect(m?.name?.length ?? 0, id).toBeGreaterThan(0);
        expect(m?.title?.length ?? 0, id).toBeGreaterThan(0);
        expect(m?.lines.length ?? 0, id).toBeGreaterThan(0);
        for (const line of m?.lines ?? []) expect(line).toMatch(prefix);
      }
    }
  );

  it.each(
    mayors
      .filter((m) => m.mayor.real || m.mayor.testimonialId)
      .map((m) => [m.mayor.id, m.islandId] as const)
  )("%s tour stops are narration only", (_id, islandId) => {
    const story = storyForIsland(islandId);
    for (const stop of story?.tour ?? []) expect(stop.voice).toBe("narrator");
  });
});
