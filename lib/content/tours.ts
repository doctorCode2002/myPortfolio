/**
 * Island stories for the 3D sky-islands world: where each project island's live project
 * window stands, the short walking route its mayor patrols, and the guided tour the mayor
 * offers. Locale-neutral: every line of text lives in the dictionaries under
 * `world.tours.<islandId>.<stopId>` (see `tourLineKey`).
 *
 * Voices: a mayor linked to a real client testimonial never gets invented words. Their tour
 * lines are neutral narrator lines (voice "narrator"), shown as narration, not as quotes.
 * Demo mayors may speak demo lines (voice "demo"), which the UI tags as demo text.
 *
 * Coordinates are island-local axial hexes (content/islands3d/<id>.json). The tests in
 * components/game3d/story/routes.test.ts check that every waypoint and stop is walkable,
 * standable and reachable, and that pauses keep clear of the doors.
 */

import type { ProjectId } from "./projects";

export type HexRef = { q: number; r: number };

export type TourVoice = "narrator" | "demo";

export type TourStopKind = "window" | "portal" | "landmark";

export type TourStop = {
  /** Line id: the text is `world.tours.<islandId>.<id>`. */
  id: string;
  kind: TourStopKind;
  /** Where the mayor stands (the player gathers around). */
  stand: HexRef;
  voice: TourVoice;
};

/** The framed screen that shows the project's live site near its portal. */
export type ProjectWindow = {
  /** Hex under the screen; `offset` nudges it in metres (x, z). */
  at: HexRef;
  offset?: readonly [number, number];
  /** Height of the screen centre above the ground (metres). */
  lift: number;
  /** The screen faces this hex. */
  face: HexRef;
  /** Screenshots for the slideshow; defaults to the project's own image. */
  images?: readonly string[];
};

export type IslandStory = {
  islandId: ProjectId;
  mayorId: string;
  /** 3-5 pause points near the mayor's building, walked in order. */
  route: readonly HexRef[];
  routeMode: "loop" | "pingpong";
  window: ProjectWindow;
  /** 2-4 stops, in order. */
  tour: readonly TourStop[];
};

export const ISLAND_STORIES: Readonly<Record<ProjectId, IslandStory>> = {
  waco: {
    islandId: "waco",
    mayorId: "mayor_waco",
    route: [
      { q: 1, r: 0 },
      { q: 1, r: 1 },
      { q: 0, r: 2 },
    ],
    routeMode: "pingpong",
    window: {
      at: { q: 1, r: -3 },
      offset: [0.2, 0],
      lift: 2.0,
      face: { q: 0, r: 0 },
    },
    // Wejdan is a real person: every stop is narration, never her words.
    tour: [
      {
        id: "window",
        kind: "window",
        stand: { q: 1, r: -2 },
        voice: "narrator",
      },
      {
        id: "portal",
        kind: "portal",
        stand: { q: 0, r: -1 },
        voice: "narrator",
      },
      {
        id: "yard",
        kind: "landmark",
        stand: { q: -3, r: 0 },
        voice: "narrator",
      },
      {
        id: "pavilion",
        kind: "landmark",
        stand: { q: -2, r: -1 },
        voice: "narrator",
      },
    ],
  },
  khidmty: {
    islandId: "khidmty",
    mayorId: "mayor_khidmty",
    route: [
      { q: 2, r: 0 },
      { q: -1, r: -1 },
      { q: -2, r: 0 },
      { q: -1, r: 2 },
    ],
    routeMode: "loop",
    window: {
      at: { q: 0, r: -2 },
      offset: [-0.4, 0],
      lift: 2.35,
      face: { q: 0, r: 1 },
    },
    // Bahaa is a real person: narration only, never invented words.
    tour: [
      {
        id: "window",
        kind: "window",
        stand: { q: 0, r: -1 },
        voice: "narrator",
      },
      {
        id: "portal",
        kind: "portal",
        stand: { q: 1, r: -1 },
        voice: "narrator",
      },
      {
        id: "landmark",
        kind: "landmark",
        stand: { q: 1, r: 0 },
        voice: "narrator",
      },
    ],
  },
  civicmind: {
    islandId: "civicmind",
    mayorId: "mayor_civicmind",
    route: [
      { q: -2, r: 1 },
      { q: 1, r: 0 },
      { q: 2, r: -1 },
    ],
    routeMode: "pingpong",
    window: {
      at: { q: 1, r: -1 },
      offset: [0.4, 0.2],
      lift: 2.0,
      face: { q: 0, r: 2 },
    },
    tour: [
      { id: "window", kind: "window", stand: { q: 1, r: 0 }, voice: "demo" },
      { id: "portal", kind: "portal", stand: { q: -1, r: 0 }, voice: "demo" },
      {
        id: "landmark",
        kind: "landmark",
        stand: { q: -2, r: 1 },
        voice: "demo",
      },
    ],
  },
  onyx: {
    islandId: "onyx",
    mayorId: "mayor_onyx",
    route: [
      { q: 0, r: 1 },
      { q: -1, r: 0 },
      { q: 0, r: -2 },
    ],
    routeMode: "pingpong",
    window: {
      at: { q: 0, r: -1 },
      offset: [-0.5, 0.2],
      lift: 2.0,
      face: { q: 0, r: 2 },
    },
    tour: [
      { id: "window", kind: "window", stand: { q: -1, r: 0 }, voice: "demo" },
      { id: "portal", kind: "portal", stand: { q: 0, r: 0 }, voice: "demo" },
      {
        id: "landmark",
        kind: "landmark",
        stand: { q: 0, r: 1 },
        voice: "demo",
      },
    ],
  },
  saleh: {
    islandId: "saleh",
    mayorId: "mayor_saleh",
    route: [
      { q: 3, r: -2 },
      { q: 0, r: 0 },
      { q: -1, r: -1 },
    ],
    routeMode: "pingpong",
    window: {
      at: { q: 0, r: -1 },
      offset: [-0.5, 0.2],
      lift: 2.0,
      face: { q: 0, r: 2 },
    },
    tour: [
      {
        id: "window",
        kind: "window",
        stand: { q: 0, r: 0 },
        voice: "narrator",
      },
      {
        id: "portal",
        kind: "portal",
        stand: { q: 1, r: -1 },
        voice: "narrator",
      },
      {
        id: "landmark",
        kind: "landmark",
        stand: { q: -1, r: -1 },
        voice: "narrator",
      },
    ],
  },
  eyad: {
    islandId: "eyad",
    mayorId: "mayor_eyad",
    route: [
      { q: 2, r: 0 },
      { q: 0, r: 1 },
      { q: -2, r: 1 },
    ],
    routeMode: "pingpong",
    window: {
      at: { q: -1, r: 0 },
      offset: [-0.3, 0],
      lift: 2.0,
      face: { q: 0, r: 2 },
    },
    tour: [
      {
        id: "window",
        kind: "window",
        stand: { q: -1, r: 1 },
        voice: "narrator",
      },
      {
        id: "portal",
        kind: "portal",
        stand: { q: 0, r: 0 },
        voice: "narrator",
      },
      {
        id: "landmark",
        kind: "landmark",
        stand: { q: 0, r: 2 },
        voice: "narrator",
      },
    ],
  },
};

export const STORY_LIST: readonly IslandStory[] = Object.values(ISLAND_STORIES);

export function storyForIsland(islandId: string): IslandStory | undefined {
  return STORY_LIST.find((s) => s.islandId === islandId);
}

export function storyForMayor(mayorId: string): IslandStory | undefined {
  return STORY_LIST.find((s) => s.mayorId === mayorId);
}

/** Dictionary path (under `world.tours`) of a tour stop's line. */
export function tourLineKey(islandId: string, stopId: string): string {
  return `${islandId}.${stopId}`;
}

/** The tech-stack rack at the home forge (E opens the stack panel). */
export const FORGE_RACK = {
  islandId: "home",
  buildingId: "building_stack",
  /** Against the terrace wall west of the anvil, facing the camera's default heading. */
  at: { q: 4, r: -3 },
  offset: [-0.25, -0.3] as const,
  /** Facing angle in degrees around +y (0 faces +z). */
  rot: 0,
} as const;
