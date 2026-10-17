/**
 * World data model for the sky-islands game mode at /[lang]/play.
 *
 * Follows the site's existing architecture:
 * - Locale-neutral structure, coordinates, biomes, and identities live here.
 * - All player-facing prose (island signs, building prompts, mayor dialogue,
 *   hobbies, family, and news copy) lives in `app/dictionaries/{en,ar}.json`
 *   under the `world` root key, addressed by id.
 *
 * Layout overview:
 * - Central "home" island at (0, 0): represents the developer's life with info
 *   buildings for education, experience, stack, hobbies, family, plus a news board.
 * - Project islands arranged on a ring around home: one island per entry in
 *   `PROJECTS` (from `lib/content/projects.ts`), sized and spaced to prevent
 *   footprint overlap, each featuring a portal building and a resident mayor.
 * - Bridges link home to each project island, with cross-bridges connecting
 *   related disciplines (e.g. graphic designer client portfolios).
 */

import {
  EDUCATION,
  EXPERIENCE,
  type EducationId,
  type ExperienceId,
} from "./about";
import type { TestimonialId } from "./people";
import { PROJECTS, type ProjectId } from "./projects";

export type IslandId = "home" | ProjectId;

export type CharacterId =
  "char_0" | "char_1" | "char_2" | "char_3" | "char_4" | "char_5";

export type IslandSize = "s" | "m" | "l";

export type Biome = "meadow" | "desert" | "snow" | "autumn" | "crystal";

/** Coordinates relative to an island centre in 16px tiles. */
export type Tile = { x: number; y: number };

export type Building =
  | { id: string; kind: "portal"; projectId: ProjectId; at: Tile }
  | { id: string; kind: "info"; section: InfoSection; at: Tile }
  | { id: string; kind: "board"; at: Tile };

export type InfoSection =
  | { type: "education"; ids: readonly EducationId[] }
  | { type: "experience"; ids: readonly ExperienceId[] }
  | { type: "stack" }
  | { type: "hobbies" }
  | { type: "family" };

export type Mayor = {
  id: string;
  sprite: CharacterId;
  /** Link to an existing testimonial when the mayor is a client. */
  testimonialId?: TestimonialId;
  at: Tile;
  demo?: boolean;
};

export type Bridge = {
  from: IslandId;
  to: IslandId;
  style?: "rope" | "stone";
};

export type NewsItem = {
  id: string;
  date: string /* ISO */;
  href?: string;
};

export type Island = {
  id: IslandId;
  /** World position of the island centre, in tiles (16px). Home is (0, 0). */
  at: { x: number; y: number };
  size: IslandSize;
  biome: Biome;
  buildings: Building[];
  mayor?: Mayor;
};

/** Footprint radius in tiles for each size tier, used for layout clearance and bounds. */
export const ISLAND_RADIUS: Record<IslandSize, number> = {
  s: 12,
  m: 18,
  l: 26,
} as const;

/** Home island seed definition. */
const HOME_ISLAND: Island = {
  id: "home",
  at: { x: 0, y: 0 },
  size: "l",
  biome: "meadow",
  buildings: [
    {
      id: "building_education",
      kind: "info",
      section: {
        type: "education",
        ids: EDUCATION.map((e) => e.id),
      },
      at: { x: -8, y: -6 },
    },
    {
      id: "building_experience",
      kind: "info",
      section: {
        type: "experience",
        ids: EXPERIENCE.map((e) => e.id),
      },
      at: { x: 8, y: -6 },
    },
    {
      id: "building_stack",
      kind: "info",
      section: { type: "stack" },
      at: { x: -10, y: 4 },
    },
    {
      id: "building_hobbies",
      kind: "info",
      section: { type: "hobbies" },
      at: { x: 10, y: 4 },
    },
    {
      id: "building_family",
      kind: "info",
      section: { type: "family" },
      at: { x: -5, y: 10 },
    },
    {
      id: "board_news",
      kind: "board",
      at: { x: 5, y: 10 },
    },
  ],
};

type ProjectIslandConfig = {
  at: Tile;
  size: IslandSize;
  biome: Biome;
  portalAt: Tile;
  mayor: Mayor;
};

/**
 * Configuration per project id. Adding a new `ProjectId` to `lib/content/projects.ts`
 * requires a corresponding entry here, ensuring exhaustive world island coverage.
 */
const PROJECT_ISLAND_CONFIGS: Record<ProjectId, ProjectIslandConfig> = {
  khidmty: {
    at: { x: 0, y: -75 },
    size: "m",
    biome: "meadow",
    portalAt: { x: 0, y: -2 },
    mayor: {
      id: "mayor_khidmty",
      sprite: "char_3",
      at: { x: 3, y: 1 },
      demo: true, // DEMO: replace with real content
    },
  },
  civicmind: {
    at: { x: 86, y: -28 },
    size: "m",
    biome: "crystal",
    portalAt: { x: 0, y: -2 },
    mayor: {
      id: "mayor_civicmind",
      sprite: "char_4",
      at: { x: 3, y: 1 },
      demo: true, // DEMO: replace with real content
    },
  },
  onyx: {
    at: { x: 65, y: 40 },
    size: "m",
    biome: "desert",
    portalAt: { x: 0, y: -2 },
    mayor: {
      id: "mayor_onyx",
      sprite: "char_5",
      at: { x: 3, y: 1 },
      demo: true, // DEMO: replace with real content
    },
  },
  saleh: {
    at: { x: -65, y: 40 },
    size: "m",
    biome: "autumn",
    portalAt: { x: 0, y: -2 },
    mayor: {
      id: "mayor_saleh",
      sprite: "char_1",
      testimonialId: "saleh",
      at: { x: 3, y: 1 },
    },
  },
  eyad: {
    at: { x: -86, y: -28 },
    size: "m",
    biome: "snow",
    portalAt: { x: 0, y: -2 },
    mayor: {
      id: "mayor_eyad",
      sprite: "char_2",
      testimonialId: "eyad",
      at: { x: 3, y: 1 },
    },
  },
};

/**
 * All islands in the sky realm: home life island + one island per project in `PROJECTS`.
 */
export const ISLANDS: readonly Island[] = [
  HOME_ISLAND,
  ...PROJECTS.map((project): Island => {
    const config = PROJECT_ISLAND_CONFIGS[project.id];
    return {
      id: project.id,
      at: config.at,
      size: config.size,
      biome: config.biome,
      buildings: [
        {
          id: `portal_${project.id}`,
          kind: "portal",
          projectId: project.id,
          at: config.portalAt,
        },
      ],
      mayor: config.mayor,
    };
  }),
] as const;

/**
 * Bridges connecting islands: home bridges to each project island.
 */
export const BRIDGES: readonly Bridge[] = [
  { from: "home", to: "khidmty", style: "stone" },
  { from: "home", to: "civicmind", style: "rope" },
  { from: "home", to: "onyx", style: "rope" },
  { from: "home", to: "saleh", style: "stone" },
  { from: "home", to: "eyad", style: "rope" },
] as const;

/**
 * News items displayed on the central notice board.
 */
export const NEWS: readonly NewsItem[] = [
  {
    id: "launch",
    date: "2026-10-17",
  },
] as const;
