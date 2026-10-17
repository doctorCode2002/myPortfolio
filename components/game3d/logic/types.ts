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

export type IslandUnderside = {
  depth?: number;
  style?: "rock" | "sand";
  seed?: number;
  waterfalls?: { q: number; r: number }[];
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
  underside?: IslandUnderside;
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
