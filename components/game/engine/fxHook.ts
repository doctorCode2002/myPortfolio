import type Phaser from "phaser";
import type { IllustratedIsland } from "./world/illustratedIsland";

export interface WorldFxSystem {
  create(scene: Phaser.Scene, islands: IllustratedIsland[]): void;
  update(dt: number): void;
}

let activeFx: WorldFxSystem | null = null;

export function registerWorldFx(fx: WorldFxSystem | null): void {
  activeFx = fx;
}

export function getActiveWorldFx(): WorldFxSystem | null {
  return activeFx;
}
