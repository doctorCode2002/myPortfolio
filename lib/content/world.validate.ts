/**
 * World integrity validator.
 *
 * Verifies graph connectivity, coordinate clearance, island coverage,
 * and dictionary completeness across both English and Arabic locales.
 */

import arDictionary from "@/app/dictionaries/ar.json";
import enDictionary from "@/app/dictionaries/en.json";
import { EDUCATION, EXPERIENCE } from "./about";
import { PROJECTS } from "./projects";
import {
  BRIDGES,
  ISLAND_RADIUS,
  ISLANDS,
  NEWS,
  type Bridge,
  type Island,
  type IslandId,
  type NewsItem,
} from "./world";
import { neighbors } from "./world.selectors";

export type WorldData = {
  islands?: readonly Island[];
  bridges?: readonly Bridge[];
  news?: readonly NewsItem[];
};

export type ValidateWorldOptions = {
  world?: WorldData;
  dictionaries?: {
    en: Record<string, unknown>;
    ar: Record<string, unknown>;
  };
};

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function checkKeys(
  entry: unknown,
  name: string,
  keys: readonly string[],
  loc: string,
  errs: string[]
): Record<string, unknown> | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errs.push(`Missing ${name} in "${loc}" dictionary`);
    return null;
  }
  for (const k of keys) {
    if (!isStr((entry as Record<string, unknown>)[k])) {
      errs.push(`Missing or empty ${name}.${k} in "${loc}" dictionary`);
    }
  }
  return entry as Record<string, unknown>;
}

function checkHome(home: Island | undefined, errs: string[]): void {
  if (!home) return void errs.push('Missing "home" island in world data');
  if (home.at.x !== 0 || home.at.y !== 0) {
    errs.push(
      `"home" island must be located at (0, 0), found (${home.at.x}, ${home.at.y})`
    );
  }
  const find = (t: string) =>
    home.buildings.find((b) => b.kind === "info" && b.section.type === t);
  const check = (t: string, items: readonly { id: string }[]) => {
    const b = find(t);
    const set = new Set<string>(
      b && b.kind === "info" && "ids" in b.section ? b.section.ids : []
    );
    for (const { id } of items)
      if (!set.has(id)) errs.push(`${t} info building missing id: "${id}"`);
  };
  check("education", EDUCATION);
  check("experience", EXPERIENCE);
  for (const s of ["stack", "hobbies", "family"])
    if (!find(s)) errs.push(`Missing ${s} info building on "home" island`);
  if (!home.buildings.some((b) => b.kind === "board"))
    errs.push('Missing board building on "home" island');
}

function checkOverlap(islands: readonly Island[], errs: string[]): void {
  for (let i = 0; i < islands.length; i++) {
    for (let j = i + 1; j < islands.length; j++) {
      const a = islands[i]!,
        b = islands[j]!;
      const dist = Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y);
      const min = ISLAND_RADIUS[a.size] + ISLAND_RADIUS[b.size];
      if (dist < min)
        errs.push(
          `Island "${a.id}" and "${b.id}" overlap (distance: ${dist.toFixed(1)}, required: ${min})`
        );
    }
  }
}

function validateStructure(
  islands: readonly Island[],
  bridges: readonly Bridge[],
  errs: string[]
): void {
  const ids = new Set<string>();
  for (const i of islands) {
    if (ids.has(i.id)) errs.push(`Duplicate island id: "${i.id}"`);
    ids.add(i.id);
  }

  for (const p of PROJECTS) {
    const count = islands.filter((i) => i.id === p.id).length;
    if (count !== 1) {
      errs.push(
        count === 0
          ? `Missing island for project: "${p.id}"`
          : `Multiple islands for: "${p.id}"`
      );
    }
  }

  checkHome(
    islands.find((i) => i.id === "home"),
    errs
  );

  const bIds = new Set<string>(),
    mIds = new Set<string>();
  for (const i of islands) {
    for (const b of i.buildings) {
      if (bIds.has(b.id)) errs.push(`Duplicate building id: "${b.id}"`);
      else bIds.add(b.id);
    }
    if (i.mayor) {
      if (mIds.has(i.mayor.id))
        errs.push(`Duplicate mayor id: "${i.mayor.id}"`);
      else mIds.add(i.mayor.id);
    }
  }

  for (const b of bridges) {
    if (!ids.has(b.from))
      errs.push(`Bridge endpoint "from" does not exist: "${b.from}"`);
    if (!ids.has(b.to))
      errs.push(`Bridge endpoint "to" does not exist: "${b.to}"`);
    if (b.from === b.to)
      errs.push(`Bridge cannot connect island "${b.from}" to itself`);
  }

  if (islands.some((i) => i.id === "home")) {
    const reachable = new Set<IslandId>(["home"]);
    const queue: IslandId[] = ["home"];
    while (queue.length > 0) {
      for (const n of neighbors(queue.shift()!, bridges)) {
        if (!reachable.has(n) && ids.has(n)) {
          reachable.add(n);
          queue.push(n);
        }
      }
    }
    for (const i of islands) {
      if (!reachable.has(i.id))
        errs.push(`Island "${i.id}" is not reachable from "home"`);
    }
  }

  checkOverlap(islands, errs);
}

function validateLocaleDict(
  loc: "en" | "ar",
  dict: Record<string, unknown>,
  islands: readonly Island[],
  news: readonly NewsItem[],
  errs: string[]
): void {
  const world = dict["world"] as Record<string, unknown> | undefined;
  if (!world || typeof world !== "object")
    return void errs.push(`Missing "world" section in "${loc}" dictionary`);

  const wIslands = (world["islands"] as Record<string, unknown>) ?? {};
  const wBuildings = (world["buildings"] as Record<string, unknown>) ?? {};
  const wMayors = (world["mayors"] as Record<string, unknown>) ?? {};
  const tItems =
    ((dict["testimonials"] as Record<string, unknown>)?.["items"] as Record<
      string,
      unknown
    >) ?? {};

  for (const i of islands) {
    checkKeys(
      wIslands[i.id],
      `world.islands.${i.id}`,
      ["name", "sign"],
      loc,
      errs
    );
    for (const b of i.buildings) {
      // In-progress projects carry their own text (lib/content/in-progress.ts).
      if (b.kind === "progress") continue;
      checkKeys(
        wBuildings[b.id],
        `world.buildings.${b.id}`,
        ["sign", "enterPrompt"],
        loc,
        errs
      );
    }
    if (i.mayor) {
      const m = i.mayor;
      const entry = checkKeys(
        wMayors[m.id],
        `world.mayors.${m.id}`,
        m.testimonialId ? [] : ["name", "title"],
        loc,
        errs
      );
      if (entry) {
        if (m.testimonialId)
          checkKeys(
            tItems[m.testimonialId],
            `testimonials.items.${m.testimonialId}`,
            ["name", "role", "quote"],
            loc,
            errs
          );
        const lines = entry["lines"];
        if (!Array.isArray(lines) || !lines.length || !lines.every(isStr)) {
          errs.push(
            `Missing or invalid world.mayors.${m.id}.lines in "${loc}" dictionary`
          );
        }
      }
    }
  }

  for (const s of ["hobbies", "family"] as const)
    checkKeys(world[s], `world.${s}`, ["title", "body"], loc, errs);
  for (const n of news)
    checkKeys(
      (world["news"] as Record<string, unknown>)?.[n.id],
      `world.news.${n.id}`,
      ["title", "body"],
      loc,
      errs
    );
}

/**
 * Validates the integrity of world structure, graph connectivity, footprint
 * spacing, and dictionary coverage. Returns a list of error descriptions.
 */
export function validateWorld(options?: ValidateWorldOptions): string[] {
  const islands = options?.world?.islands ?? ISLANDS;
  const bridges = options?.world?.bridges ?? BRIDGES;
  const news = options?.world?.news ?? NEWS;
  const dicts = options?.dictionaries ?? {
    en: enDictionary as unknown as Record<string, unknown>,
    ar: arDictionary as unknown as Record<string, unknown>,
  };

  const errors: string[] = [];
  validateStructure(islands, bridges, errors);
  validateLocaleDict("en", dicts.en, islands, news, errors);
  validateLocaleDict("ar", dicts.ar, islands, news, errors);
  return errors;
}
