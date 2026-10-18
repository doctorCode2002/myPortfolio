/**
 * Exploration collectibles: the sky shards hidden around the islands and the signal fire
 * on each island (fast travel). Coordinates are island-local axial hexes (as in
 * content/islands3d/<id>.json) plus an optional offset in metres from the hex centre.
 * collectibles.test.ts (components/game3d/meta) checks that every shard and fire is
 * reachable on foot from the home spawn with the real model bounds.
 */

export type MetaSpot = {
  islandId: string;
  q: number;
  r: number;
  /** Metres from the hex centre: [dx, dz]. */
  offset?: readonly [number, number];
};

export type ShardSpot = MetaSpot & {
  id: string;
  /** Hover height above the ground (metres); default SHARD_HEIGHT. */
  height?: number;
  /** Where it hides (for content authors; not shown to players). */
  note: string;
};

/** The islands in passport order. */
export const META_ISLANDS = [
  "home",
  "khidmty",
  "civicmind",
  "onyx",
  "saleh",
  "eyad",
  "workshop",
  "waco",
] as const;

export type MetaIslandId = (typeof META_ISLANDS)[number];

export const SHARD_HEIGHT = 0.75;
/** Walk within this distance (metres, horizontal) to pick a shard up. */
export const SHARD_PICKUP_RANGE = 1.2;

export const SHARDS: readonly ShardSpot[] = [
  {
    id: "home-hedges",
    islandId: "home",
    q: 4,
    r: 3,
    offset: [0.25, 0.05],
    note: "in the hedge garden, just behind the pavilion",
  },
  {
    id: "home-castle",
    islandId: "home",
    q: 3,
    r: -7,
    offset: [0, -0.63],
    note: "behind the castle, on the upper terrace",
  },
  {
    id: "khidmty-tavern",
    islandId: "khidmty",
    q: 1,
    r: -3,
    offset: [0.33, 0.45],
    note: "beside the tavern, up the slope",
  },
  {
    id: "khidmty-landing",
    islandId: "khidmty",
    q: -2,
    r: 5,
    offset: [-0.75, 0.5],
    note: "beside the bridge landing",
  },
  {
    id: "civicmind-terrace",
    islandId: "civicmind",
    q: 2,
    r: -4,
    offset: [-0.25, 0.48],
    note: "on the town hall terrace",
  },
  {
    id: "civicmind-falls",
    islandId: "civicmind",
    q: 2,
    r: 1,
    offset: [0.5, 0],
    note: "by the waterfall pool",
  },
  {
    id: "onyx-terrace",
    islandId: "onyx",
    q: -4,
    r: 2,
    offset: [0.33, -0.25],
    note: "up on the palm terrace",
  },
  {
    id: "onyx-falls",
    islandId: "onyx",
    q: 2,
    r: 0,
    offset: [-0.25, 0.73],
    note: "by the oasis waterfall",
  },
  {
    id: "saleh-terrace",
    islandId: "saleh",
    q: -3,
    r: -2,
    offset: [0.25, 0.75],
    note: "on the high terrace under the autumn trees",
  },
  {
    id: "saleh-falls",
    islandId: "saleh",
    q: -2,
    r: 4,
    offset: [-0.25, 0.48],
    note: "by the stream that becomes a waterfall",
  },
  {
    id: "eyad-studio",
    islandId: "eyad",
    q: -1,
    r: -2,
    offset: [0.5, -0.5],
    note: "behind the studio",
  },
  {
    id: "eyad-falls",
    islandId: "eyad",
    q: -3,
    r: 4,
    offset: [0.25, 0.48],
    note: "by the blossom waterfall",
  },
  {
    id: "workshop-office",
    islandId: "workshop",
    q: 0,
    r: -3,
    offset: [0.5, 0],
    note: "behind the site office",
  },
  {
    id: "workshop-stage",
    islandId: "workshop",
    q: -3,
    r: 4,
    offset: [0.5, 0],
    note: "behind the stage",
  },
  {
    id: "waco-yard",
    islandId: "waco",
    q: -2,
    r: -1,
    offset: [0.3, -0.3],
    note: "in the engineering yard, in front of the drafting pavilion",
  },
  {
    id: "waco-dunes",
    islandId: "waco",
    q: -4,
    r: 3,
    offset: [0.3, -0.4],
    note: "out on the dunes past the factories",
  },
];

/** One signal fire per island, beside its arrival point (the bridge from home; home: the plaza). */
export const SIGNAL_FIRES: Readonly<Record<MetaIslandId, MetaSpot>> = {
  home: { islandId: "home", q: -3, r: 3, offset: [0.75, 0] },
  khidmty: { islandId: "khidmty", q: -1, r: 5, offset: [-0.5, -0.75] },
  civicmind: { islandId: "civicmind", q: -3, r: 2, offset: [0.25, -1] },
  onyx: { islandId: "onyx", q: -2, r: -2, offset: [0, -0.98] },
  saleh: { islandId: "saleh", q: 5, r: -3, offset: [0, -0.73] },
  eyad: { islandId: "eyad", q: 3, r: 2, offset: [-0.75, 0.02] },
  workshop: { islandId: "workshop", q: 2, r: -4, offset: [0.25, -0.25] },
  waco: { islandId: "waco", q: -1, r: 4, offset: [-0.5, 0.3] },
};

/** Walk within this distance of a fire to light it. */
export const FIRE_RANGE = 1.7;

export function shardsOnIsland(islandId: string): ShardSpot[] {
  return SHARDS.filter((s) => s.islandId === islandId);
}
