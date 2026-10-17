export const GAME_CONSTANTS = {
  WORLD_WIDTH: 1600,
  WORLD_HEIGHT: 1200,

  ISLAND: {
    CENTER_X: 800,
    CENTER_Y: 550,
    // Visual grass dimensions
    SURFACE_RADIUS_X: 220,
    SURFACE_RADIUS_Y: 105,
    // Strict walkable boundary
    WALK_RADIUS_X: 200,
    WALK_RADIUS_Y: 88,
    // Underside rock depth
    ROCK_BOTTOM_Y: 830,
    // Shadow depth
    SHADOW_Y: 800,
  },

  PLAYER: {
    START_X: 800,
    START_Y: 550,
    SPEED: 110, // pixels per second
    FRAME_WIDTH: 16,
    FRAME_HEIGHT: 32,
    ANIM_FPS: 8,
  },

  DEPTHS: {
    SKY: -100,
    BACKGROUND_CLOUDS: -50,
    MIDGROUND_CLOUDS: -20,
    SHADOW: 2,
    ROCK: 5,
    DIRT: 8,
    GRASS: 10,
    DETAILS: 12,
    PLAYER_SHADOW: 19,
    PLAYER: 20,
    FOREGROUND_CLOUDS: 30,
    TOUCH_UI: 100,
  },
} as const;

export function computeIntegerZoom(width: number, height: number): number {
  const minDim = Math.min(width, height);
  if (minDim < 520) return 2;
  if (minDim < 900) return 3;
  return 4;
}

export function isInsideWalkableIsland(x: number, y: number): boolean {
  const dx =
    (x - GAME_CONSTANTS.ISLAND.CENTER_X) / GAME_CONSTANTS.ISLAND.WALK_RADIUS_X;
  const dy =
    (y - GAME_CONSTANTS.ISLAND.CENTER_Y) / GAME_CONSTANTS.ISLAND.WALK_RADIUS_Y;
  return dx * dx + dy * dy <= 1.0;
}
