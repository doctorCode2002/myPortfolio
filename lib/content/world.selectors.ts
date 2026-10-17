/**
 * Pure selectors and lookups for the sky-islands world data model.
 */

import {
  BRIDGES,
  ISLAND_RADIUS,
  ISLANDS,
  type Bridge,
  type Island,
  type IslandId,
  type Mayor,
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

export type MayorDialogue = {
  name: string;
  title: string;
  lines: readonly string[];
  quote?: string;
  testimonialLabel?: string;
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

/**
 * Assembles the dialogue and metadata for an island's mayor.
 *
 * For mayors linked to a client testimonial (`testimonialId`), their name,
 * role/title, and quote are resolved verbatim from `testimonials.items.<id>`
 * so that no quotes are invented or paraphrased. The mayor's own `lines` in
 * `world.mayors` contain only a neutral narrator greeting.
 */
export function getMayorDialogue(
  mayor: Mayor,
  dict: Record<string, unknown>
): MayorDialogue {
  const world =
    typeof dict["world"] === "object" && dict["world"] !== null
      ? (dict["world"] as Record<string, unknown>)
      : undefined;
  const worldMayors =
    typeof world?.["mayors"] === "object" && world["mayors"] !== null
      ? (world["mayors"] as Record<string, unknown>)
      : undefined;
  const mayorEntry =
    typeof worldMayors?.[mayor.id] === "object" &&
    worldMayors[mayor.id] !== null
      ? (worldMayors[mayor.id] as Record<string, unknown>)
      : undefined;

  const rawLines = mayorEntry?.["lines"];
  const greetingLines: string[] = Array.isArray(rawLines)
    ? rawLines.filter((l): l is string => typeof l === "string")
    : [];

  if (mayor.testimonialId) {
    const testimonials =
      typeof dict["testimonials"] === "object" && dict["testimonials"] !== null
        ? (dict["testimonials"] as Record<string, unknown>)
        : undefined;
    const items =
      typeof testimonials?.["items"] === "object" &&
      testimonials["items"] !== null
        ? (testimonials["items"] as Record<string, unknown>)
        : undefined;
    const item =
      typeof items?.[mayor.testimonialId] === "object" &&
      items[mayor.testimonialId] !== null
        ? (items[mayor.testimonialId] as Record<string, unknown>)
        : undefined;

    if (item) {
      const name = typeof item["name"] === "string" ? item["name"] : "";
      const title = typeof item["role"] === "string" ? item["role"] : "";
      const quote = typeof item["quote"] === "string" ? item["quote"] : "";
      const testimonialLabel =
        typeof testimonials?.["eyebrow"] === "string"
          ? testimonials["eyebrow"]
          : "Testimonial";

      return {
        name,
        title,
        lines: quote ? [...greetingLines, quote] : greetingLines,
        quote,
        testimonialLabel,
      };
    }
  }

  const name =
    typeof mayorEntry?.["name"] === "string" ? mayorEntry["name"] : "";
  const title =
    typeof mayorEntry?.["title"] === "string" ? mayorEntry["title"] : "";

  return {
    name,
    title,
    lines: greetingLines,
  };
}

export { validateWorld } from "./world.validate";
