import { isPointInCorridor, type BridgeCorridor } from "./bridgeGeometry";
import { canWalkFeetBox } from "./materialMap";

export interface IslandWalkState {
  id: string;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  walkGrid: Uint8Array;
  gw: number;
  gh: number;
}

/**
 * Pure world-position walkability predicate shared identically by:
 * - Runtime Player.move and collision checks
 * - BFS connectivity and reachability verification tests
 *
 * A world coordinate (wx, wy) representing the player's feet center is walkable if:
 * 1. It falls inside any walkable bridge corridor (including overlap and width), OR
 * 2. It satisfies the 10x4 feet box check (canWalkFeetBox) entirely within any island's walkable grid.
 */
export function isWorldPositionWalkable(
  wx: number,
  wy: number,
  corridors: readonly BridgeCorridor[],
  islands: readonly IslandWalkState[]
): boolean {
  for (let i = 0; i < corridors.length; i++) {
    if (isPointInCorridor(corridors[i]!, wx, wy)) {
      return true;
    }
  }

  for (let i = 0; i < islands.length; i++) {
    const isl = islands[i]!;
    const lx = wx - isl.worldX;
    const ly = wy - isl.worldY;
    if (lx >= 0 && lx < isl.width && ly >= 0 && ly < isl.height) {
      if (
        canWalkFeetBox(
          isl.walkGrid,
          isl.gw,
          isl.gh,
          lx,
          ly,
          isl.width,
          isl.height
        )
      ) {
        return true;
      }
    }
  }

  return false;
}
