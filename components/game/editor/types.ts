import type { IslandArt } from "../engine/world/illustratedIsland";

export type EditorTool =
  "walkable" | "blockers" | "doors" | "occluders" | "spawns" | "anchors";

export interface EditorLayerState {
  walkable: boolean;
  blockers: boolean;
  doors: boolean;
  occluders: boolean;
  spawns: boolean;
  anchors: boolean;
}

export const KNOWN_BUILDING_IDS = [
  "castle",
  "academy",
  "forge",
  "pavilion",
  "cottage",
  "notice_board",
] as const;

export interface EditorState {
  art: IslandArt;
  tool: EditorTool;
  layers: EditorLayerState;
  selectedBlockerIdx: number;
  selectedDoorIdx: number;
  selectedOccluderIdx: number;
  selectedAnchorIdx: number;
}
