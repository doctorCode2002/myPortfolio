import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";
import { gameEvents } from "../events";

export interface BuildingConfig {
  id: string;
  titleKey: "demoBuildingTitle";
  messageKey: "demoBuildingDialogue";
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export class Building {
  public readonly config: BuildingConfig;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly promptBubble: Phaser.GameObjects.Graphics;

  private isPlayerAtDoor = false;
  private doorX: number;
  private doorY: number;

  constructor(scene: Phaser.Scene, config: BuildingConfig) {
    this.config = {
      width: 76,
      height: 68,
      ...config,
    };

    const { DEPTHS } = ENGINE_CONSTANTS;
    this.doorX = this.config.x;
    this.doorY = this.config.y + 4;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(DEPTHS.DETAILS);

    this.promptBubble = scene.add.graphics();
    this.promptBubble.setDepth(DEPTHS.DETAILS + 10);
    this.promptBubble.setVisible(false);

    this.renderBuilding();
    this.drawDoorPrompt();
  }

  public get inRange(): boolean {
    return this.isPlayerAtDoor;
  }

  public interact(): void {
    gameEvents.emit("interact:building", {
      buildingId: this.config.id,
      titleKey: this.config.titleKey,
      messageKey: this.config.messageKey,
    });
  }

  public isColliding(px: number, py: number): boolean {
    const w = this.config.width ?? 76;
    const h = this.config.height ?? 68;
    const left = this.config.x - w / 2 + 4;
    const right = this.config.x + w / 2 - 4;
    const top = this.config.y - h + 24;
    const bottom = this.config.y;

    // Solid building body (door area at front bottom allows approach)
    if (px >= left && px <= right && py >= top && py <= bottom) {
      // Allow player feet into the door approach zone
      if (Math.abs(px - this.doorX) < 14 && py >= bottom - 8) {
        return false;
      }
      return true;
    }
    return false;
  }

  public update(playerX: number, playerY: number, time: number): boolean {
    const dist = Math.hypot(playerX - this.doorX, playerY - this.doorY);
    const wasAtDoor = this.isPlayerAtDoor;
    this.isPlayerAtDoor = dist <= 38;

    if (this.isPlayerAtDoor) {
      if (!wasAtDoor) {
        this.promptBubble.setVisible(true);
      }
      const bob = Math.sin(time * 0.006) * 2;
      this.promptBubble.y = bob;
    } else if (wasAtDoor) {
      this.promptBubble.setVisible(false);
    }

    return this.isPlayerAtDoor;
  }

  private renderBuilding(): void {
    const { x, y } = this.config;
    const w = this.config.width ?? 76;
    const h = this.config.height ?? 68;
    const left = x - w / 2;
    const top = y - h;

    // 1. Soft Shadow on grass
    this.graphics.fillStyle(0x1a293d, 0.2);
    this.graphics.fillEllipse(x, y + 5, w + 16, 18);

    // 2. Stone Foundation / Wall
    this.graphics.fillStyle(0xdfd7ca, 1);
    this.graphics.fillRect(left + 6, top + 26, w - 12, h - 26);

    // Dark timber corner posts & cross beams
    this.graphics.fillStyle(0x4a3a30, 1);
    this.graphics.fillRect(left + 6, top + 26, 4, h - 26);
    this.graphics.fillRect(left + w - 10, top + 26, 4, h - 26);
    this.graphics.fillRect(left + 6, top + 26, w - 12, 3);
    this.graphics.fillRect(left + 6, y - 2, w - 12, 2);

    // 3. Pitched Terracotta Roof
    // Main roof face
    this.graphics.fillStyle(0xab4c24, 1);
    this.graphics.fillTriangle(x, top, left, top + 28, left + w, top + 28);

    // Roof highlight facet (left sunlight)
    this.graphics.fillStyle(0xc0592e, 1);
    this.graphics.fillTriangle(x, top, left, top + 28, x, top + 28);

    // Roof overhang trim
    this.graphics.fillStyle(0x6e2c14, 1);
    this.graphics.fillRect(left - 2, top + 27, w + 4, 3);

    // 4. Arched Wooden Door
    this.graphics.fillStyle(0x52341e, 1);
    this.graphics.fillRoundedRect(x - 9, y - 20, 18, 20, {
      tl: 6,
      tr: 6,
      bl: 0,
      br: 0,
    });

    // Inner door shadow & brass handle
    this.graphics.fillStyle(0x382212, 1);
    this.graphics.fillRect(x - 7, y - 17, 14, 17);
    this.graphics.fillStyle(0xf5d061, 1);
    this.graphics.fillRect(x + 2, y - 9, 2, 2);

    // 5. Glowing Pixel Window
    const winX = left + 15;
    const winY = top + 34;
    this.graphics.fillStyle(0x4a3a30, 1);
    this.graphics.fillRect(winX - 1, winY - 1, 14, 14);
    this.graphics.fillStyle(0xffd76a, 0.95);
    this.graphics.fillRect(winX, winY, 12, 12);
    // Window cross pane
    this.graphics.fillStyle(0x4a3a30, 0.8);
    this.graphics.fillRect(winX + 5, winY, 2, 12);
    this.graphics.fillRect(winX, winY + 5, 12, 2);

    // 6. Hanging Wooden Sign (on right side of door)
    const signX = x + 16;
    const signY = y - 16;
    // Iron wall bracket
    this.graphics.fillStyle(0x222222, 1);
    this.graphics.fillRect(signX - 2, signY - 4, 14, 2);
    // Hanging board
    this.graphics.fillStyle(0x82542e, 1);
    this.graphics.fillRect(signX, signY - 2, 11, 8);
    this.graphics.fillStyle(0x5a381c, 1);
    this.graphics.strokeRect(signX, signY - 2, 11, 8);
  }

  private drawDoorPrompt(): void {
    const bx = this.doorX;
    const by = this.doorY - 32;

    this.promptBubble.clear();

    // Bubble outline & body
    this.promptBubble.fillStyle(0x14110f, 0.9);
    this.promptBubble.fillRoundedRect(bx - 10, by - 10, 20, 18, 4);
    this.promptBubble.fillTriangle(bx - 3, by + 8, bx + 3, by + 8, bx, by + 12);

    // Inner background
    this.promptBubble.fillStyle(0xf5f2e9, 1);
    this.promptBubble.fillRoundedRect(bx - 8, by - 8, 16, 14, 3);

    // Pixel "E" glyph in terracotta
    this.promptBubble.fillStyle(0xab4c24, 1);
    this.promptBubble.fillRect(bx - 4, by - 5, 2, 8);
    this.promptBubble.fillRect(bx - 2, by - 5, 5, 2);
    this.promptBubble.fillRect(bx - 2, by - 2, 4, 2);
    this.promptBubble.fillRect(bx - 2, by + 1, 5, 2);
  }
}
