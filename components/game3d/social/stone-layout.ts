/** Where the guestbook stone stands: a free, flat, walkable hex near the notice board. */

import type { IslandWalkGrid, WalkCell } from "../logic/walk-grid";
import { hexKey } from "../logic/hex";
import { obstacleDistance } from "../logic/walk-grid";

export const GUESTBOOK_STONE_ID = "guestbook_stone";

/** Preferred home hexes, nearest the notice board (2, -1) first. */
export const STONE_HEXES: readonly { q: number; r: number }[] = [
  { q: 3, r: 0 },
  { q: 0, r: -2 },
  { q: 2, r: -3 },
  { q: 3, r: -3 },
];

export function pickStoneCell(
  grid: IslandWalkGrid,
  preferred: readonly { q: number; r: number }[] = STONE_HEXES
): WalkCell | null {
  for (const h of preferred) {
    const cell = grid.cells.get(hexKey(h.q, h.r));
    if (!cell || !cell.ground || cell.blocked || cell.water || cell.slope)
      continue;
    const clear = grid.obstacles.every(
      (o) => obstacleDistance(o, cell.x, cell.z) > 0.55
    );
    if (clear) return cell;
  }
  return null;
}
