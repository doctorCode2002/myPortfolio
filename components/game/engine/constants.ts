export const ENGINE_CONSTANTS = {
  WORLD_WIDTH: 1600,
  WORLD_HEIGHT: 1200,

  ISLAND: {
    CENTER_X: 800,
    CENTER_Y: 550,
    SURFACE_RADIUS_X: 220,
    SURFACE_RADIUS_Y: 105,
    WALK_RADIUS_X: 200,
    WALK_RADIUS_Y: 88,
    SHADOW_Y: 800,
    ROCK_BOTTOM_Y: 830,
  },

  PLAYER: {
    START_X: 800,
    START_Y: 550,
    SPEED: 110, // pixels per second
    FRAME_WIDTH: 16,
    FRAME_HEIGHT: 32,
    ANIM_FPS: 8,
    FEET_OFFSET_Y: 12,
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

/**
 * Integer camera zoom:
 * - Desktop: zoom 2 provides crisp 2x pixels while keeping the entire island
 *   surrounded by generous sky margin for the floating feel.
 * - 4K displays: zoom 3 maintains the floating sky ratio.
 * - Phones: zoom 2 keeps the character comfortably close and legible on narrow screens.
 */
export function computeIntegerZoom(width: number, height: number): number {
  if (width >= 2400 && height >= 1350) return 3;
  return 2;
}
