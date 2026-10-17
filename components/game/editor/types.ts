import type { MaterialClass } from "../engine/world/materialMap";
export {
  MATERIAL_PALETTE,
  type MaterialClass,
} from "../engine/world/materialMap";

export type EditorTool = "brush" | "fill" | "doors" | "spawns" | "anchors";

export interface EditorLayerState {
  materialOverlay: boolean;
  doors: boolean;
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
  tool: EditorTool;
  activeMaterial: MaterialClass;
  brushSize: number;
  layers: EditorLayerState;
  selectedDoorIdx: number;
  selectedAnchorIdx: number;
}
