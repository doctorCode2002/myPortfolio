import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";
import { gameEvents } from "../events";

export interface IslandArt {
  version: 1;
  size: { w: number; h: number };
  walkable: Array<Array<[number, number]>>;
  blockers: Array<Array<[number, number]>>;
  occluders: Array<{
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

export function isPointInPolygon(
  x: number,
  y: number,
  poly: Array<[number, number]>
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]?.[0] ?? 0;
    const yi = poly[i]?.[1] ?? 0;
    const xj = poly[j]?.[0] ?? 0;
    const yj = poly[j]?.[1] ?? 0;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export class IllustratedIsland {
  public readonly worldX: number;
  public readonly worldY: number;
  public readonly art: IslandArt;

  private readonly baseImage: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly promptBubble: Phaser.GameObjects.Graphics;
  private readonly occluderSlices: Array<{
    image: Phaser.GameObjects.Image;
    baseY: number;
  }> = [];

  private activeDoorId: string | null = null;
  private lastEnteredDoorId: string | null = null;

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    art: IslandArt,
    worldX: number,
    worldY: number
  ) {
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

    // 3. Occluder slices: cropped regions rendered above player when player.y < baseY
    const texture = scene.textures.get(textureKey);
    for (const occ of art.occluders) {
      const frameKey = `occ_${textureKey}_${occ.id}`;
      const [rx, ry, rw, rh] = occ.rect;
      if (!texture.has(frameKey)) {
        texture.add(frameKey, 0, rx, ry, rw, rh);
      }
      const sliceImg = scene.add.image(
        worldX + rx,
        worldY + ry,
        textureKey,
        frameKey
      );
      sliceImg.setOrigin(0, 0);
      sliceImg.setDepth(worldY + occ.baseY + 50);
      sliceImg.setVisible(false);
      this.occluderSlices.push({ image: sliceImg, baseY: worldY + occ.baseY });
    }

    // 4. Door interaction prompt bubble
    this.promptBubble = scene.add.graphics();
    this.promptBubble.setDepth(15000);
    this.promptBubble.setVisible(false);
    this.renderPromptBubble();
  }

  public isInsideWalkable(worldPx: number, worldPy: number): boolean {
    const lx = worldPx - this.worldX;
    const ly = worldPy - this.worldY;

    // Must be inside at least one walkable polygon
    let insideWalkable = false;
    for (const poly of this.art.walkable) {
      if (isPointInPolygon(lx, ly, poly)) {
        insideWalkable = true;
        break;
      }
    }
    if (!insideWalkable) return false;

    // Must NOT be inside any blocker polygon
    for (const blocker of this.art.blockers) {
      if (isPointInPolygon(lx, ly, blocker)) {
        return false;
      }
    }

    return true;
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

    // 1. Occluder visibility: slice is visible when player is behind building/tree
    for (const slice of this.occluderSlices) {
      slice.image.setVisible(feetY < slice.baseY);
    }

    // 2. Door radius detection
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
      // Step-in trigger on enter zone
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

  private renderPromptBubble(): void {
    this.promptBubble.clear();
    // Bubble outline & body
    this.promptBubble.fillStyle(0x14110f, 0.9);
    this.promptBubble.fillRoundedRect(-10, -10, 20, 18, 4);
    this.promptBubble.fillTriangle(-3, 8, 3, 8, 0, 12);
    // Inner background
    this.promptBubble.fillStyle(0xf5f2e9, 1);
    this.promptBubble.fillRoundedRect(-8, -8, 16, 14, 3);
    // Pixel "E" glyph
    this.promptBubble.fillStyle(0xab4c24, 1);
    this.promptBubble.fillRect(-4, -5, 2, 8);
    this.promptBubble.fillRect(-2, -5, 5, 2);
    this.promptBubble.fillRect(-2, -2, 4, 2);
    this.promptBubble.fillRect(-2, 1, 5, 2);
  }
}
