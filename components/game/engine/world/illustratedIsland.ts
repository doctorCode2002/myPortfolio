import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";
import { gameEvents } from "../events";
import {
  extractOcclusionObjects,
  destroyOcclusionObjects,
  type OcclusionObject,
} from "./autoDepth";
import { buildWalkGrid, canWalkFeetBox } from "./materialMap";

export interface IslandArt {
  version: 1;
  size: { w: number; h: number };
  walkable?: Array<Array<[number, number]>>;
  blockers?: Array<Array<[number, number]>>;
  occluders?: Array<{
    id: string;
    rect: [number, number, number, number];
    baseY: number;
  }>;
  doors: Array<{
    buildingId: string;
    at: [number, number];
    radius: number;
  }>;
  spawns: {
    player?: [number, number];
    mayor?: [number, number];
  };
  anchors: Array<{
    id: string;
    at: [number, number];
  }>;
}

export class IllustratedIsland {
  public readonly scene: Phaser.Scene;
  public readonly worldX: number;
  public readonly worldY: number;
  public art: IslandArt;

  public materialCanvas: HTMLCanvasElement;
  private walkGrid!: Uint8Array;
  private gw = 0;
  private gh = 0;

  private readonly baseImage: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly promptBubble: Phaser.GameObjects.Graphics;
  private occlusionObjects: OcclusionObject[] = [];

  private activeDoorId: string | null = null;
  private lastEnteredDoorId: string | null = null;

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    materialTextureKey: string,
    art: IslandArt,
    worldX: number,
    worldY: number
  ) {
    this.scene = scene;
    this.art = art;
    this.worldX = worldX;
    this.worldY = worldY;

    const { DEPTHS } = ENGINE_CONSTANTS;

    // 1. Soft atmospheric shadow below the floating island
    this.shadow = scene.add.graphics();
    this.shadow.setDepth(DEPTHS.SHADOW);
    this.shadow.fillStyle(0x0c1322, 0.28);
    this.shadow.fillEllipse(
      worldX + art.size.w / 2,
      worldY + art.size.h + 20,
      art.size.w * 0.75,
      60
    );

    // 2. Base painted island image (1:1 world pixels)
    this.baseImage = scene.add.image(worldX, worldY, textureKey);
    this.baseImage.setOrigin(0, 0);
    this.baseImage.setDepth(DEPTHS.GRASS);

    // 3. Prepare material canvas & 2px walk grid
    this.materialCanvas = document.createElement("canvas");
    this.materialCanvas.width = art.size.w;
    this.materialCanvas.height = art.size.h;
    const ctx = this.materialCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    const matSource = scene.textures
      .get(materialTextureKey)
      .getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    if (matSource && ctx) {
      ctx.drawImage(matSource, 0, 0, art.size.w, art.size.h);
      this.rebuildWalkGrid();
      this.occlusionObjects = extractOcclusionObjects(
        scene,
        worldX,
        worldY,
        textureKey,
        this.materialCanvas
      );
    }

    // 4. Door interaction prompt bubble
    this.promptBubble = scene.add.graphics();
    this.promptBubble.setDepth(15000);
    this.promptBubble.setVisible(false);
    this.renderPromptBubble();
  }

  public rebuildWalkGrid(): void {
    const ctx = this.materialCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, this.art.size.w, this.art.size.h);
    const { grid, gw, gh } = buildWalkGrid(
      imgData.data,
      this.art.size.w,
      this.art.size.h
    );
    this.walkGrid = grid;
    this.gw = gw;
    this.gh = gh;
  }

  public isInsideWalkable(worldPx: number, worldPy: number): boolean {
    if (!this.walkGrid) return true;
    const lx = worldPx - this.worldX;
    const ly = worldPy - this.worldY;
    return canWalkFeetBox(
      this.walkGrid,
      this.gw,
      this.gh,
      lx,
      ly,
      this.art.size.w,
      this.art.size.h
    );
  }

  public get activeDoor(): string | null {
    return this.activeDoorId;
  }

  public interact(): void {
    if (this.activeDoorId) {
      gameEvents.emit("interact:building", {
        buildingId: this.activeDoorId,
        titleKey: "demoBuildingTitle",
        messageKey: "demoBuildingDialogue",
      });
    }
  }

  public update(playerX: number, playerY: number, time: number): void {
    const feetY = playerY + ENGINE_CONSTANTS.PLAYER.FEET_OFFSET_Y;

    let closestDoor: { id: string; x: number; y: number; dist: number } | null =
      null;
    for (const door of this.art.doors) {
      const dx = this.worldX + door.at[0];
      const dy = this.worldY + door.at[1];
      const dist = Math.hypot(playerX - dx, feetY - dy);
      if (dist <= door.radius) {
        if (!closestDoor || dist < closestDoor.dist) {
          closestDoor = { id: door.buildingId, x: dx, y: dy, dist };
        }
      }
    }

    const prevDoor = this.activeDoorId;
    this.activeDoorId = closestDoor?.id ?? null;

    if (closestDoor) {
      if (this.lastEnteredDoorId !== closestDoor.id) {
        this.lastEnteredDoorId = closestDoor.id;
        this.interact();
      }

      this.promptBubble.setVisible(true);
      const bob = Math.sin(time * 0.006) * 2;
      this.promptBubble.setPosition(closestDoor.x, closestDoor.y - 32 + bob);
    } else {
      this.lastEnteredDoorId = null;
      if (prevDoor) {
        this.promptBubble.setVisible(false);
      }
    }
  }

  public destroy(): void {
    destroyOcclusionObjects(this.scene, this.occlusionObjects);
    this.occlusionObjects = [];
    this.shadow.destroy();
    this.baseImage.destroy();
    this.promptBubble.destroy();
  }

  private renderPromptBubble(): void {
    this.promptBubble.clear();
    this.promptBubble.fillStyle(0x14110f, 0.9);
    this.promptBubble.fillRoundedRect(-10, -10, 20, 18, 4);
    this.promptBubble.fillTriangle(-3, 8, 3, 8, 0, 12);
    this.promptBubble.fillStyle(0xf5f2e9, 1);
    this.promptBubble.fillRoundedRect(-8, -8, 16, 14, 3);
    this.promptBubble.fillStyle(0xab4c24, 1);
    this.promptBubble.fillRect(-4, -5, 2, 8);
    this.promptBubble.fillRect(-2, -5, 5, 2);
    this.promptBubble.fillRect(-2, -2, 4, 2);
    this.promptBubble.fillRect(-2, 1, 5, 2);
  }
}
