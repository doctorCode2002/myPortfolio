/**
 * Data contracts for the 3D world: island definitions (content/islands3d/<id>.json)
 * and the asset manifest (public/game3d/models/manifest.json). Pure types only.
 */

export type HexTile = {
  q: number;
  r: number;
  /** Model name in the manifest (e.g. "hex-grass"). */
  tile: string;
  /** Stacked height level, 0..3. */
  h?: number;
  /** Rotation in degrees (multiples of 60). */
  rot?: number;
  /** Optional override of the tile's walkability. */
  walkable?: boolean;
  /**
   * Optional ground colouring for this hex: "sand" grades grass tiles (e.g. grass slopes
   * used as dune ramps) and the grass skin to sand; "meadow" forces green on a desert island.
   */
  tint?: "sand" | "meadow";
};

export type IslandObject = {
  model: string;
  q: number;
  r: number;
  /** Degrees around +y. */
  rot?: number;
  scale?: number;
  /** Offset from the hex centre in metres: [dx, dz]. */
  offset?: [number, number];
  /** Override of the manifest/heuristic solidity. */
  solid?: boolean;
};

export type IslandDoor = {
  buildingId: string;
  q: number;
  r: number;
  /** Interaction radius in hex widths (default 0.9). */
  radius?: number;
};

export type IslandAnchor = { id: string; q: number; r: number };

/** A talkable NPC besides the mayor (e.g. a project owner at a workshop lot). */
export type IslandResident = {
  /** NPC id: its name, title and lines are world.mayors.<id> in the dictionaries. */
  id: string;
  q: number;
  r: number;
  /** Resting heading in degrees (0 faces +z). */
  rot?: number;
  /** Character sheet id for the portrait and the fallback model. */
  sprite?: string;
};

/** A drivable vehicle parked on an island (the car spawn). */
export type IslandVehicle = {
  id: string;
  q: number;
  r: number;
  /** Heading in degrees around +y (0 faces +z, like object rotations). */
  rot?: number;
};

export type IslandUnderside = {
  depth?: number;
  style?: "rock" | "sand";
  seed?: number;
  waterfalls?: { q: number; r: number }[];
};

/** A glider launch platform (E there starts a glide). */
export type IslandLaunch = {
  id: string;
  q: number;
  r: number;
  /** Launch heading in degrees around +y (0 faces +z); default: away from the island centre. */
  rot?: number;
  /** Offset from the hex centre in metres: [dx, dz]. */
  offset?: [number, number];
};

/** A flat-topped lookout tower on a hex, standable on top (reached only by a jump pad). */
export type IslandLookout = {
  id: string;
  q: number;
  r: number;
  /** Deck height above the ground in metres (default 3). */
  height?: number;
  /** Where its return pad drops the player (a ground hex nearby). */
  down: { q: number; r: number };
};

/** A springy jump pad on a hex: launches to a lookout or to another hex of the island. */
export type IslandPad = {
  id: string;
  q: number;
  r: number;
  to: { lookout: string } | { q: number; r: number };
};

/** A zipline from a hex of this island down to a hex of another (E at the post to ride). */
export type IslandZipline = {
  id: string;
  q: number;
  r: number;
  to: { island: string; q: number; r: number };
  /** Cable height above the start hex (default 4.2 m); it ends hand-high above the far hex. */
  height?: number;
};

/** Movement features of an island (gliding, jump pads, lookouts, ziplines). */
export type IslandMovement = {
  launches?: IslandLaunch[];
  lookouts?: IslandLookout[];
  pads?: IslandPad[];
  ziplines?: IslandZipline[];
};

export type Island3D = {
  id: string;
  /** Marks starter content that the island designers should replace. */
  placeholder?: boolean;
  /** Free-form note for content authors (ignored by the engine). */
  _note?: string;
  /** World placement of the island origin (metres): [x, z]. */
  center: [number, number];
  baseY?: number;
  /**
   * Optional gentle ground undulation in metres (e.g. 0.05): grass tops and the walk
   * heights follow one continuous noise field, so the hex grid reads less.
   */
  heightJitter?: number;
  /** Optional biome hint for procedural colours. */
  biome?: string;
  hexes: HexTile[];
  objects?: IslandObject[];
  doors?: IslandDoor[];
  spawns?: {
    player?: { q: number; r: number };
    mayor?: { q: number; r: number; rot?: number };
  };
  anchors?: IslandAnchor[];
  /** Extra talkable NPCs (residents) besides the mayor. */
  residents?: IslandResident[];
  /** Optional drivable vehicles parked on this island. */
  vehicles?: IslandVehicle[];
  underside?: IslandUnderside;
  /** Optional glider launches, jump pads and lookouts. */
  movement?: IslandMovement;
};

export type ModelKind =
  | "terrain"
  | "building"
  | "nature"
  | "prop"
  | "character"
  | "bridge"
  | "animation"
  | string;

export type ManifestModel = {
  file: string;
  /** Short content hash of the file (scripts/3d/hash-models.mjs); versions the URL so it can be cached forever. */
  hash?: string;
  source?: string;
  license?: string;
  kind: ModelKind;
  footprint?: [number, number];
  /** "hex" for terrain and buildings, "m" for props and nature. */
  footprintUnit?: "hex" | "m";
  /** Measured size after `scale`: [x, y, z] in metres. */
  size?: [number, number, number];
  /** Lowest y after `scale` (tiles: -1, so their top sits at y = 0). */
  minY?: number;
  /** Terrain decorations that sit on top of a tile. */
  overlay?: boolean;
  /** Not part of the first load. */
  lazy?: boolean;
  height?: number;
  scale?: number;
  tags?: string[];
  animations?: string[];
  banned?: boolean;
  reason?: string;
  /** Optional explicit walkability for terrain tiles. */
  walkable?: boolean;
  /** Optional explicit solidity for objects. */
  solid?: boolean;
  /** Characters: other manifest models whose animation clips this rig shares. */
  animationSources?: string[];
};

export type Manifest = {
  version: number;
  unit?: string;
  /** Hex tile width across flats, in metres. */
  hexSize?: number;
  /** Height of one stacked level, in metres. */
  levelHeight?: number;
  tileThickness?: number;
  characterHeight?: number;
  /** Extra manifest files (relative to the models folder) whose models are merged in. */
  fragments?: string[];
  models: Record<string, ManifestModel>;
};

/** A manifest fragment: more models, e.g. one island designer's procedural props. */
export type ManifestFragment = { models: Record<string, ManifestModel> };
