/**
 * Which 3D character stands in for each 2D character id from the character picker
 * (char_0..char_5), and which villager plays each mayor. Each entry lists preferences;
 * the first model present (and not banned) in the manifest wins.
 */

import type { Manifest } from "../logic/types";
import { allowedModel } from "./manifest";

export const PLAYER_CHARACTERS: Record<string, readonly string[]> = {
  char_0: ["character-rogue", "character-knight"],
  char_1: ["character-knight-bare", "character-knight"],
  char_2: ["character-mage", "character-mage-bare"],
  char_3: ["character-barbarian-bare", "character-barbarian"],
  char_4: ["character-rogue-hooded", "character-rogue"],
  char_5: ["character-mage-bare", "character-mage"],
};

export const MAYOR_CHARACTERS: Record<string, readonly string[]> = {
  // The real island owners have their own stylized characters (scripts/3d/people.mjs).
  mayor_khidmty: [
    "character-bahaa",
    "character-mini-male-b",
    "character-barbarian-bare",
  ],
  mayor_civicmind: ["character-mini-female-a", "character-mage-bare"],
  mayor_onyx: ["character-mini-female-c", "character-rogue-hooded"],
  mayor_saleh: [
    "character-saleh",
    "character-mini-male-d",
    "character-knight-bare",
  ],
  mayor_eyad: ["character-eyad", "character-mini-male-e", "character-rogue"],
  mayor_waco: ["character-wejdan", "character-mini-female-b"],
  npc_teryaq_owner: ["character-anas", "character-mini-male-c"],
};

/** Placeholder capsule colours per character id (used until the model loads or if it is missing). */
export const CHARACTER_COLORS: Record<string, string> = {
  char_0: "#5b8bd9",
  char_1: "#d9735b",
  char_2: "#8d5bd9",
  char_3: "#5bd98a",
  char_4: "#d9c25b",
  char_5: "#d95ba8",
};

function firstAvailable(
  manifest: Manifest | null,
  names: readonly string[] | undefined
): string | null {
  for (const n of names ?? []) {
    const m = allowedModel(manifest, n);
    if (m && m.kind === "character") return n;
  }
  return null;
}

export function playerModelFor(
  manifest: Manifest | null,
  charId: string
): string | null {
  const preferred = firstAvailable(manifest, PLAYER_CHARACTERS[charId]);
  if (preferred) return preferred;
  // Any allowed player character, picked stably by the id's digit.
  const all = Object.entries(manifest?.models ?? {})
    .filter(
      ([, m]) =>
        m.kind === "character" && !m.banned && (m.tags ?? []).includes("player")
    )
    .map(([n]) => n);
  if (all.length === 0) return null;
  const idx = Number(charId.replace(/\D/g, "")) || 0;
  return all[idx % all.length] ?? null;
}

export function mayorModelFor(
  manifest: Manifest | null,
  mayorId: string,
  sprite: string
): string | null {
  return (
    firstAvailable(manifest, MAYOR_CHARACTERS[mayorId]) ??
    playerModelFor(manifest, sprite)
  );
}

/** Pick animation clip names for idle / walk / run from what a model offers. */
export function pickClips(names: readonly string[]): {
  idle: string | null;
  walk: string | null;
  run: string | null;
} {
  const find = (...patterns: RegExp[]): string | null => {
    for (const p of patterns) {
      const hit = names.find((n) => p.test(n));
      if (hit) return hit;
    }
    return null;
  };
  return {
    idle: find(/^idle$/i, /^unarmed_idle$/i, /idle/i, /static/i),
    walk: find(/^walking_a$/i, /^walk$/i, /walk(?!.*back)/i),
    run: find(/^running_a$/i, /^sprint$/i, /^run$/i, /run|sprint/i),
  };
}

/** A greeting clip (KayKit "Cheer", or a Kenney mini character's wave-like emote), if any. */
export function pickCheerClip(names: readonly string[]): string | null {
  for (const p of [
    /^cheer$/i,
    /cheer|wave/i,
    /^interact-right$/i,
    /^emote-yes$/i,
  ]) {
    const hit = names.find((n) => p.test(n));
    if (hit) return hit;
  }
  return null;
}
