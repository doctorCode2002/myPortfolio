/**
 * Exploration progress (the passport): islands visited, mayors met, tours taken, shards
 * found, fires lit, bridges driven, props smashed, weather and time seen, the balloon's
 * view from above the clouds, plus the
 * achievements and unlocks they earn. Pure: no browser, three or react imports; the
 * store (store.ts) persists it.
 */

import { META_ISLANDS, SHARDS } from "@/lib/content/collectibles";

export const PROGRESS_VERSION = 1;

export const ACHIEVEMENTS = [
  "visitAll",
  "mayorsAll",
  "tour",
  "shardsAll",
  "smash50",
  "bridgesAll",
  "nightOwl",
  "rain",
  "aboveClouds",
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number];

export const SMASH_GOAL = 50;

export type MetaSettings = {
  /** The compass points at the nearest unfound shard. */
  compassShards: boolean;
  /** Golden paint on the car (once unlocked). */
  goldCar: boolean;
  /** Wear the golden cloak (once unlocked; chosen in the character picker). */
  goldCloak: boolean;
};

export type Progress = {
  v: number;
  visited: string[];
  mayors: string[];
  tours: string[];
  shards: string[];
  fires: string[];
  bridges: string[];
  smashed: number;
  night: boolean;
  rain: boolean;
  /** Finished a scenic balloon tour or reached the balloon's ceiling. */
  sky: boolean;
  achievements: AchievementId[];
  settings: MetaSettings;
};

/** Which islands have a mayor (and which a tour); filled by the caller from the content. */
export type MetaRules = {
  mayorIslands: readonly string[];
  bridgeIds: readonly string[];
};

export function emptyProgress(): Progress {
  return {
    v: PROGRESS_VERSION,
    visited: [],
    mayors: [],
    tours: [],
    shards: [],
    fires: [],
    bridges: [],
    smashed: 0,
    night: false,
    rain: false,
    sky: false,
    achievements: [],
    settings: { compassShards: true, goldCar: true, goldCloak: false },
  };
}

function strings(v: unknown, allowed?: ReadonlySet<string>): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const s of v)
    if (
      typeof s === "string" &&
      !out.includes(s) &&
      (!allowed || allowed.has(s))
    )
      out.push(s);
  return out;
}

const SHARD_IDS = new Set(SHARDS.map((s) => s.id));
const ISLAND_IDS = new Set<string>(META_ISLANDS);
const ACH_IDS = new Set<string>(ACHIEVEMENTS);

/** Parse stored JSON (any shape) into a valid Progress; unknown versions start fresh. */
export function parseProgress(raw: string | null): Progress {
  const base = emptyProgress();
  if (!raw) return base;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!data || typeof data !== "object") return base;
  const d = data as Record<string, unknown>;
  if (d.v !== PROGRESS_VERSION) return base;
  const s = (d.settings ?? {}) as Record<string, unknown>;
  return {
    v: PROGRESS_VERSION,
    visited: strings(d.visited, ISLAND_IDS),
    mayors: strings(d.mayors, ISLAND_IDS),
    tours: strings(d.tours, ISLAND_IDS),
    shards: strings(d.shards, SHARD_IDS),
    fires: strings(d.fires, ISLAND_IDS),
    bridges: strings(d.bridges),
    smashed:
      typeof d.smashed === "number" && Number.isFinite(d.smashed)
        ? Math.max(0, Math.floor(d.smashed))
        : 0,
    night: d.night === true,
    rain: d.rain === true,
    sky: d.sky === true,
    achievements: strings(d.achievements, ACH_IDS) as AchievementId[],
    settings: {
      compassShards:
        typeof s.compassShards === "boolean"
          ? s.compassShards
          : base.settings.compassShards,
      goldCar: typeof s.goldCar === "boolean" ? s.goldCar : true,
      goldCloak: s.goldCloak === true,
    },
  };
}

export function allShardsFound(p: Progress): boolean {
  return SHARDS.every((s) => p.shards.includes(s.id));
}

/** Whether each achievement's condition holds now. */
export function achievementMet(
  p: Progress,
  id: AchievementId,
  rules: MetaRules
): boolean {
  switch (id) {
    case "visitAll":
      return META_ISLANDS.every((i) => p.visited.includes(i));
    case "mayorsAll":
      return rules.mayorIslands.every((i) => p.mayors.includes(i));
    case "tour":
      return p.tours.length > 0;
    case "shardsAll":
      return allShardsFound(p);
    case "smash50":
      return p.smashed >= SMASH_GOAL;
    case "bridgesAll":
      return (
        rules.bridgeIds.length > 0 &&
        rules.bridgeIds.every((b) => p.bridges.includes(b))
      );
    case "nightOwl":
      return p.night;
    case "rain":
      return p.rain;
    case "aboveClouds":
      return p.sky;
  }
}

/** Unlock every achievement whose condition now holds; returns the newly unlocked ones. */
export function evaluateAchievements(
  p: Progress,
  rules: MetaRules
): AchievementId[] {
  const fresh: AchievementId[] = [];
  for (const id of ACHIEVEMENTS) {
    if (p.achievements.includes(id)) continue;
    if (achievementMet(p, id, rules)) {
      p.achievements.push(id);
      fresh.push(id);
    }
  }
  return fresh;
}

/** Add `value` to a list field; true when it was new. */
export function addTo(
  p: Progress,
  field: "visited" | "mayors" | "tours" | "shards" | "fires" | "bridges",
  value: string
): boolean {
  const list = p[field];
  if (list.includes(value)) return false;
  list.push(value);
  return true;
}

/** "Drove across a bridge": entering from one end and leaving at the other. */
export function crossedBridge(
  bridge: { from: string; to: string },
  enteredFrom: string | null,
  leftTo: string | null
): boolean {
  if (!enteredFrom || !leftTo || enteredFrom === leftTo) return false;
  return (
    (enteredFrom === bridge.from && leftTo === bridge.to) ||
    (enteredFrom === bridge.to && leftTo === bridge.from)
  );
}
