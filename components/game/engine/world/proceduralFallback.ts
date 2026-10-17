import Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";
import { Building } from "../entities/Building";
import { Npc } from "../entities/Npc";
import { Player } from "../entities/Player";
import { Island } from "./islandRenderer";

export interface ProceduralFallbackEntities {
  centerIsland: Island;
  demoBuilding: Building;
  demoNpc: Npc;
  player: Player;
}

export function createProceduralFallback(
  scene: Phaser.Scene,
  initialCharSheet: string
): ProceduralFallbackEntities {
  const { ISLAND: isl, PLAYER: p } = ENGINE_CONSTANTS;

  const centerIsland = new Island(scene, {
    id: "center-island",
    centerX: isl.CENTER_X,
    centerY: isl.CENTER_Y,
    surfaceRadiusX: isl.SURFACE_RADIUS_X,
    surfaceRadiusY: isl.SURFACE_RADIUS_Y,
    walkRadiusX: isl.WALK_RADIUS_X,
    walkRadiusY: isl.WALK_RADIUS_Y,
    shadowY: isl.SHADOW_Y,
    biome: "grass",
  });

  const demoBuilding = new Building(scene, {
    id: "pavilion",
    titleKey: "demoBuildingTitle",
    messageKey: "demoBuildingDialogue",
    x: 700,
    y: 490,
  });

  const demoNpc = new Npc(scene, {
    id: "mayor",
    nameKey: "demoNpcName",
    roleKey: "demoNpcRole",
    charSheet: "char_1",
    x: 890,
    y: 540,
    dialogueKey: "demoNpcDialogue",
  });

  const player = new Player(scene, p.START_X, p.START_Y, initialCharSheet);

  return { centerIsland, demoBuilding, demoNpc, player };
}
