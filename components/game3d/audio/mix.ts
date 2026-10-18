/**
 * Pure choices for the sound mix: which music bed plays on which island and which
 * footstep sound a surface makes.
 */

import { hexKey } from "../logic/hex";
import type { Island3D } from "../logic/types";
import type { Surface, WalkWorld } from "../logic/walk-world";

export const MUSIC_TRACKS = ["meadow", "sky", "dusk"] as const;
export type MusicTrack = (typeof MUSIC_TRACKS)[number];

const ISLAND_MUSIC: Readonly<Record<string, MusicTrack>> = {
  home: "meadow",
  khidmty: "meadow",
  eyad: "sky",
  civicmind: "sky",
  saleh: "dusk",
  onyx: "dusk",
};

export function musicForIsland(islandId: string | null): MusicTrack {
  return (islandId && ISLAND_MUSIC[islandId]) || "meadow";
}

export type FootSurface = "grass" | "path" | "wood" | "stone";

/** Object models that pave a hex (plazas, stepping stones). */
const PAVING = /plaza|path-stone|cobble|paving|stone-tile/i;

/** Hexes paved by objects, as "<islandId>/<q>,<r>". */
export function pavedHexes(islands: readonly Island3D[]): Set<string> {
  const out = new Set<string>();
  for (const island of islands)
    for (const obj of island.objects ?? [])
      if (PAVING.test(obj.model))
        out.add(`${island.id}/${hexKey(obj.q, obj.r)}`);
  return out;
}

/** The footstep sound for the surface under the player. */
export function footstepSurface(
  surf: Surface | null,
  walk: WalkWorld,
  paved?: ReadonlySet<string>
): FootSurface {
  if (!surf) return "grass";
  if (surf.bridgeId) {
    const bridge = walk.bridges.find((b) => b.id === surf.bridgeId);
    return bridge?.style === "stone" ? "stone" : "wood";
  }
  const cell = surf.cell;
  if (!cell) return "grass";
  if (cell.deck) return "wood";
  if (paved?.has(`${surf.islandId}/${hexKey(cell.q, cell.r)}`)) return "stone";
  const tile = cell.tile;
  if (/stone|plaza|cobble|castle/i.test(tile)) return "stone";
  if (/road|path|dirt|sand|dune/i.test(tile)) return "path";
  return "grass";
}
