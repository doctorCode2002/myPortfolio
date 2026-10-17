import type { IslandArt } from "../world/illustratedIsland";

export interface FxConfig {
  reducedMotion?: boolean;
  lowEnd?: boolean;
  waterfallEmitters?: Array<{ x: number; y: number; width?: number }>;
  chimneyEmitters?: Array<{ x: number; y: number }>;
}

export interface LivingWorldInitOptions {
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
