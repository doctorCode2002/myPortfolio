import { ENGINE_CONSTANTS } from "../constants";

export interface DoorCandidate {
  buildingId: string;
  at: [number, number];
  radius: number;
}

export interface ClosestDoorResult {
  id: string;
  x: number;
  y: number;
  dist: number;
  radius: number;
}

/**
 * Finds the closest door within its interaction radius to the player.
 * Uses a dual-distance check (center and feet) so the player can interact
 * whether aligning by body center or feet.
 */
export function findClosestDoor(
  playerX: number,
  playerY: number,
  doors: DoorCandidate[],
  worldX = 0,
  worldY = 0,
  feetOffsetY: number = ENGINE_CONSTANTS.PLAYER.FEET_OFFSET_Y
): ClosestDoorResult | null {
  const feetY = playerY + feetOffsetY;
  let closest: ClosestDoorResult | null = null;

  for (const door of doors) {
    const dx = worldX + door.at[0];
    const dy = worldY + door.at[1];
    const distCenter = Math.hypot(playerX - dx, playerY - dy);
    const distFeet = Math.hypot(playerX - dx, feetY - dy);
    const dist = Math.min(distCenter, distFeet);

    if (dist <= door.radius) {
      if (!closest || dist < closest.dist) {
        closest = {
          id: door.buildingId,
          x: dx,
          y: dy,
          dist,
          radius: door.radius,
        };
      }
    }
  }

  return closest;
}

/**
 * Finds the nearest door to the player regardless of radius (for debug readouts).
 */
export function findNearestDoor(
  playerX: number,
  playerY: number,
  doors: DoorCandidate[],
  worldX = 0,
  worldY = 0,
  feetOffsetY: number = ENGINE_CONSTANTS.PLAYER.FEET_OFFSET_Y
): ClosestDoorResult | null {
  const feetY = playerY + feetOffsetY;
  let nearest: ClosestDoorResult | null = null;

  for (const door of doors) {
    const dx = worldX + door.at[0];
    const dy = worldY + door.at[1];
    const distCenter = Math.hypot(playerX - dx, playerY - dy);
    const distFeet = Math.hypot(playerX - dx, feetY - dy);
    const dist = Math.min(distCenter, distFeet);

    if (!nearest || dist < nearest.dist) {
      nearest = {
        id: door.buildingId,
        x: dx,
        y: dy,
        dist,
        radius: door.radius,
      };
    }
  }

  return nearest;
}
