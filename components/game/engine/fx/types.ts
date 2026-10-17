import type { IslandArt } from "../world/illustratedIsland";

export interface FxConfig {
  reducedMotion?: boolean;
  lowEnd?: boolean;
  waterfallEmitters?: Array<{ x: number; y: number; width?: number }>;
  chimneyEmitters?: Array<{ x: number; y: number }>;
}

export interface IslandFXItem {
  id: string;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  islandImageKey: string;
  materialTextureKey: string;
}

export interface LivingWorldInitOptions {
  worldBounds?: { width: number; height: number };
  islands?: IslandFXItem[];
  islandArt?: IslandArt | null;
  worldX?: number;
  worldY?: number;
  islandImageKey?: string;
  materialTextureKey?: string;
}

export interface PerchSite {
  id: string;
  x: number;
  y: number;
  depth: number;
  occupied: boolean;
}
