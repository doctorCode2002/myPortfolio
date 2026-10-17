/**
 * Pure selectors and validator for the sky-islands world data model.
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

export type WorldBounds = {
  x: number;
  y: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

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

/**
 * Retrieve an island by id.
 */
export function getIsland(
  islandId: IslandId,
  islands: readonly Island[] = ISLANDS
): Island | undefined {
  return islands.find((island) => island.id === islandId);
}

/**
 * Get all neighbor island IDs directly connected by a bridge (bidirectional).
 */
export function neighbors(
  islandId: IslandId,
  bridges: readonly Bridge[] = BRIDGES
): IslandId[] {
  const connected = new Set<IslandId>();
  for (const bridge of bridges) {
    if (bridge.from === islandId) {
      connected.add(bridge.to);
    } else if (bridge.to === islandId) {
      connected.add(bridge.from);
    }
  }
  return Array.from(connected);
}

/**
 * Calculate the bounding box and extent of an island in tile space.
 */
export function islandWorldBounds(island: Island): WorldBounds {
  const radius = ISLAND_RADIUS[island.size];
  const minX = island.at.x - radius;
  const maxX = island.at.x + radius;
  const minY = island.at.y - radius;
  const maxY = island.at.y + radius;
  const width = radius * 2;
  const height = radius * 2;

  return {
    x: minX,
    y: minY,
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates the integrity of world structure, graph connectivity, footprint
 * spacing, and dictionary coverage. Returns a list of error descriptions
 * (empty array if completely valid).
 */
export function validateWorld(options?: ValidateWorldOptions): string[] {
  const islands = options?.world?.islands ?? ISLANDS;
  const bridges = options?.world?.bridges ?? BRIDGES;
  const news = options?.world?.news ?? NEWS;

  const dictionaries = options?.dictionaries ?? {
    en: enDictionary as unknown as Record<string, unknown>,
    ar: arDictionary as unknown as Record<string, unknown>,
  };

  const errors: string[] = [];

  // 1. Island IDs must be unique
  const seenIslandIds = new Set<string>();
  for (const island of islands) {
    if (seenIslandIds.has(island.id)) {
      errors.push(`Duplicate island id: "${island.id}"`);
    }
    seenIslandIds.add(island.id);
  }

  // 2. Every ProjectId from PROJECTS must have exactly one island
  for (const project of PROJECTS) {
    const matching = islands.filter((island) => island.id === project.id);
    if (matching.length === 0) {
      errors.push(`Missing island for project: "${project.id}"`);
    } else if (matching.length > 1) {
      errors.push(
        `Multiple islands (${matching.length}) found for project: "${project.id}"`
      );
    }
  }

  // 3. Central "home" island must exist and be at (0, 0)
  const homeIsland = islands.find((island) => island.id === "home");
  if (!homeIsland) {
    errors.push('Missing "home" island in world data');
  } else {
    if (homeIsland.at.x !== 0 || homeIsland.at.y !== 0) {
      errors.push(
        `"home" island must be located at (0, 0), found (${homeIsland.at.x}, ${homeIsland.at.y})`
      );
    }

    // Check home required info buildings
    const educationBuilding = homeIsland.buildings.find(
      (b) => b.kind === "info" && b.section.type === "education"
    );
    if (!educationBuilding) {
      errors.push('Missing education info building on "home" island');
    } else if (
      educationBuilding.kind === "info" &&
      educationBuilding.section.type === "education"
    ) {
      const presentIds = new Set(educationBuilding.section.ids);
      for (const edu of EDUCATION) {
        if (!presentIds.has(edu.id)) {
          errors.push(
            `Education info building missing EducationId: "${edu.id}"`
          );
        }
      }
    }

    const experienceBuilding = homeIsland.buildings.find(
      (b) => b.kind === "info" && b.section.type === "experience"
    );
    if (!experienceBuilding) {
      errors.push('Missing experience info building on "home" island');
    } else if (
      experienceBuilding.kind === "info" &&
      experienceBuilding.section.type === "experience"
    ) {
      const presentIds = new Set(experienceBuilding.section.ids);
      for (const exp of EXPERIENCE) {
        if (!presentIds.has(exp.id)) {
          errors.push(
            `Experience info building missing ExperienceId: "${exp.id}"`
          );
        }
      }
    }

    const stackBuilding = homeIsland.buildings.find(
      (b) => b.kind === "info" && b.section.type === "stack"
    );
    if (!stackBuilding) {
      errors.push('Missing stack info building on "home" island');
    }

    const hobbiesBuilding = homeIsland.buildings.find(
      (b) => b.kind === "info" && b.section.type === "hobbies"
    );
    if (!hobbiesBuilding) {
      errors.push('Missing hobbies info building on "home" island');
    }

    const familyBuilding = homeIsland.buildings.find(
      (b) => b.kind === "info" && b.section.type === "family"
    );
    if (!familyBuilding) {
      errors.push('Missing family info building on "home" island');
    }

    const newsBoard = homeIsland.buildings.find((b) => b.kind === "board");
    if (!newsBoard) {
      errors.push('Missing board building on "home" island');
    }
  }

  // 4. Buildings and Mayors uniqueness across all islands
  const seenBuildingIds = new Set<string>();
  const seenMayorIds = new Set<string>();

  for (const island of islands) {
    for (const building of island.buildings) {
      if (seenBuildingIds.has(building.id)) {
        errors.push(`Duplicate building id: "${building.id}"`);
      }
      seenBuildingIds.add(building.id);
    }

    if (island.mayor) {
      if (seenMayorIds.has(island.mayor.id)) {
        errors.push(`Duplicate mayor id: "${island.mayor.id}"`);
      }
      seenMayorIds.add(island.mayor.id);
    }
  }

  // 5. Bridge endpoints exist and are valid
  const islandIdSet = new Set(islands.map((island) => island.id));
  for (const bridge of bridges) {
    if (!islandIdSet.has(bridge.from)) {
      errors.push(`Bridge endpoint "from" does not exist: "${bridge.from}"`);
    }
    if (!islandIdSet.has(bridge.to)) {
      errors.push(`Bridge endpoint "to" does not exist: "${bridge.to}"`);
    }
    if (bridge.from === bridge.to) {
      errors.push(`Bridge cannot connect island "${bridge.from}" to itself`);
    }
  }

  // 6. Graph is connected from "home"
  if (homeIsland) {
    const reachable = new Set<IslandId>(["home"]);
    const queue: IslandId[] = ["home"];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighborId of neighbors(current, bridges)) {
        if (!reachable.has(neighborId) && islandIdSet.has(neighborId)) {
          reachable.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    for (const island of islands) {
      if (!reachable.has(island.id)) {
        errors.push(`Island "${island.id}" is not reachable from "home"`);
      }
    }
  }

  // 7. Non-overlapping footprints
  for (let i = 0; i < islands.length; i++) {
    const a = islands[i]!;
    const radiusA = ISLAND_RADIUS[a.size];

    for (let j = i + 1; j < islands.length; j++) {
      const b = islands[j]!;
      const radiusB = ISLAND_RADIUS[b.size];

      const dx = a.at.x - b.at.x;
      const dy = a.at.y - b.at.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = radiusA + radiusB;

      if (distance < minDistance) {
        errors.push(
          `Island "${a.id}" and "${b.id}" overlap (distance: ${distance.toFixed(1)}, required: ${minDistance})`
        );
      }
    }
  }

  // 8. Dictionary key coverage in both en and ar
  const locales = ["en", "ar"] as const;

  for (const locale of locales) {
    const dict = dictionaries[locale];
    if (!isRecord(dict)) {
      errors.push(`Missing or invalid dictionary for locale: "${locale}"`);
      continue;
    }

    const world = dict["world"];
    if (!isRecord(world)) {
      errors.push(`Missing "world" section in "${locale}" dictionary`);
      continue;
    }

    // Check islands
    const worldIslands = world["islands"];
    if (!isRecord(worldIslands)) {
      errors.push(`Missing "world.islands" section in "${locale}" dictionary`);
    } else {
      for (const island of islands) {
        const islandEntry = worldIslands[island.id];
        if (!isRecord(islandEntry)) {
          errors.push(
            `Missing world.islands.${island.id} in "${locale}" dictionary`
          );
        } else {
          if (!isNonEmptyString(islandEntry["name"])) {
            errors.push(
              `Missing or empty world.islands.${island.id}.name in "${locale}" dictionary`
            );
          }
          if (!isNonEmptyString(islandEntry["sign"])) {
            errors.push(
              `Missing or empty world.islands.${island.id}.sign in "${locale}" dictionary`
            );
          }
        }
      }
    }

    // Check buildings
    const worldBuildings = world["buildings"];
    if (!isRecord(worldBuildings)) {
      errors.push(
        `Missing "world.buildings" section in "${locale}" dictionary`
      );
    } else {
      for (const island of islands) {
        for (const building of island.buildings) {
          const buildingEntry = worldBuildings[building.id];
          if (!isRecord(buildingEntry)) {
            errors.push(
              `Missing world.buildings.${building.id} in "${locale}" dictionary`
            );
          } else {
            if (!isNonEmptyString(buildingEntry["sign"])) {
              errors.push(
                `Missing or empty world.buildings.${building.id}.sign in "${locale}" dictionary`
              );
            }
            if (!isNonEmptyString(buildingEntry["enterPrompt"])) {
              errors.push(
                `Missing or empty world.buildings.${building.id}.enterPrompt in "${locale}" dictionary`
              );
            }
          }
        }
      }
    }

    // Check mayors
    const worldMayors = world["mayors"];
    if (!isRecord(worldMayors)) {
      errors.push(`Missing "world.mayors" section in "${locale}" dictionary`);
    } else {
      for (const island of islands) {
        if (island.mayor) {
          const mayorEntry = worldMayors[island.mayor.id];
          if (!isRecord(mayorEntry)) {
            errors.push(
              `Missing world.mayors.${island.mayor.id} in "${locale}" dictionary`
            );
          } else {
            if (!isNonEmptyString(mayorEntry["name"])) {
              errors.push(
                `Missing or empty world.mayors.${island.mayor.id}.name in "${locale}" dictionary`
              );
            }
            if (!isNonEmptyString(mayorEntry["title"])) {
              errors.push(
                `Missing or empty world.mayors.${island.mayor.id}.title in "${locale}" dictionary`
              );
            }
            if (
              !Array.isArray(mayorEntry["lines"]) ||
              mayorEntry["lines"].length === 0 ||
              !mayorEntry["lines"].every(isNonEmptyString)
            ) {
              errors.push(
                `Missing or invalid world.mayors.${island.mayor.id}.lines in "${locale}" dictionary`
              );
            }
          }
        }
      }
    }

    // Check hobbies and family
    const hobbies = world["hobbies"];
    if (!isRecord(hobbies)) {
      errors.push(`Missing "world.hobbies" section in "${locale}" dictionary`);
    } else {
      if (!isNonEmptyString(hobbies["title"])) {
        errors.push(
          `Missing or empty world.hobbies.title in "${locale}" dictionary`
        );
      }
      if (!isNonEmptyString(hobbies["body"])) {
        errors.push(
          `Missing or empty world.hobbies.body in "${locale}" dictionary`
        );
      }
    }

    const family = world["family"];
    if (!isRecord(family)) {
      errors.push(`Missing "world.family" section in "${locale}" dictionary`);
    } else {
      if (!isNonEmptyString(family["title"])) {
        errors.push(
          `Missing or empty world.family.title in "${locale}" dictionary`
        );
      }
      if (!isNonEmptyString(family["body"])) {
        errors.push(
          `Missing or empty world.family.body in "${locale}" dictionary`
        );
      }
    }

    // Check news
    const worldNews = world["news"];
    if (!isRecord(worldNews)) {
      errors.push(`Missing "world.news" section in "${locale}" dictionary`);
    } else {
      for (const item of news) {
        const newsEntry = worldNews[item.id];
        if (!isRecord(newsEntry)) {
          errors.push(
            `Missing world.news.${item.id} in "${locale}" dictionary`
          );
        } else {
          if (!isNonEmptyString(newsEntry["title"])) {
            errors.push(
              `Missing or empty world.news.${item.id}.title in "${locale}" dictionary`
            );
          }
          if (!isNonEmptyString(newsEntry["body"])) {
            errors.push(
              `Missing or empty world.news.${item.id}.body in "${locale}" dictionary`
            );
          }
        }
      }
    }
  }

  return errors;
}
