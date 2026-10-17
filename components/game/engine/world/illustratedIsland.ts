import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";
import { gameEvents } from "../events";
import {
  extractOcclusionObjects,
  destroyOcclusionObjects,
  type OcclusionObject,
} from "./autoDepth";
import { InteractionPrompt } from "./interactionPrompt";
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
  private readonly dict: Record<string, unknown> | undefined;
  private readonly locale: string;

  public materialCanvas: HTMLCanvasElement;
  private walkGrid!: Uint8Array;
  private gw = 0;
  private gh = 0;

  private readonly baseImage: Phaser.GameObjects.Image;
  private readonly prompt: InteractionPrompt;
  private occlusionObjects: OcclusionObject[] = [];

  private activeDoorId: string | null = null;

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    materialTextureKey: string,
    art: IslandArt,
    worldX: number,
    worldY: number,
    dict?: Record<string, unknown>,
    locale = "en"
  ) {
    this.scene = scene;
    this.art = art;
    this.worldX = worldX;
    this.worldY = worldY;
    this.dict = dict;
    this.locale = locale;

    const { DEPTHS } = ENGINE_CONSTANTS;

    // Base painted island image (1:1 world pixels)
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

    // 4. Door interaction prompt
    this.prompt = new InteractionPrompt(scene);
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
    if (!this.walkGrid) return false;
    const lx = worldPx - this.worldX;
    const ly = worldPy - this.worldY;
    if (lx < 0 || lx >= this.art.size.w || ly < 0 || ly >= this.art.size.h) {
      return false;
    }
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
      const signText = this.getDoorSign(closestDoor.id);
      this.prompt.showPrompt(closestDoor.x, closestDoor.y - 36, signText, () =>
        this.interact()
      );
      this.prompt.updateBob(time);
    } else if (prevDoor) {
      this.prompt.hide();
    }
  }

  public destroy(): void {
    destroyOcclusionObjects(this.scene, this.occlusionObjects);
    this.occlusionObjects = [];
    this.baseImage.destroy();
    this.prompt.destroy();
  }

  private getDoorSign(doorId: string): string {
    const rawSign = (
      this.dict as {
        world?: {
          buildings?: Record<string, { sign?: string }>;
        };
      } | null
    )?.world?.buildings?.[doorId]?.sign;

    if (typeof rawSign === "string" && rawSign.trim().length > 0) {
      const trimmed = rawSign.trim();
      const title = trimmed.includes("—")
        ? trimmed.split("—")[0]!.trim()
        : trimmed;
      if (title) return title;
    }

    if (this.locale === "ar") {
      return "مدخل";
    }

    const formatted = doorId
      .replace(/^building_/, "")
      .replace(/^portal_/, "")
      .replace(/_/g, " ");
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
}
