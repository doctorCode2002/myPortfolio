import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";
import { gameEvents } from "../events";

export interface NpcConfig {
  id: string;
  nameKey: string;
  roleKey: string;
  charSheet: string;
  x: number;
  y: number;
  interactionRadius?: number;
  dialogueKey: "demoNpcDialogue";
}

export class Npc {
  public readonly config: NpcConfig;
  public readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly promptBubble: Phaser.GameObjects.Graphics;

  private isPlayerInRange = false;
  private basePromptY: number;

  constructor(scene: Phaser.Scene, config: NpcConfig) {
    this.config = {
      interactionRadius: 48,
      ...config,
    };

    const { DEPTHS } = ENGINE_CONSTANTS;

    // Shadow below NPC feet
    this.shadow = scene.add.graphics();
    this.shadow.setDepth(DEPTHS.PLAYER_SHADOW);
    this.shadow.fillStyle(0x000000, 0.28);
    this.shadow.fillEllipse(this.config.x, this.config.y + 12, 14, 6);

    // NPC Sprite
    this.sprite = scene.add.sprite(
      this.config.x,
      this.config.y,
      this.config.charSheet,
      1 // Default facing down
    );
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDepth(DEPTHS.PLAYER);

    // Make NPC interactive on touch / mouse click
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on("pointerdown", () => {
      if (this.isPlayerInRange) {
        this.interact();
      }
    });

    // Pixel prompt bubble above head ("E" key / talk bubble)
    this.basePromptY = this.config.y - 28;
    this.promptBubble = scene.add.graphics();
    this.promptBubble.setDepth(DEPTHS.DETAILS + 10);
    this.promptBubble.setVisible(false);
    this.drawPromptBubble();
  }

  public get inRange(): boolean {
    return this.isPlayerInRange;
  }

  public get x(): number {
    return this.config.x;
  }

  public get y(): number {
    return this.config.y;
  }

  public interact(): void {
    gameEvents.emit("interact:npc", {
      npcId: this.config.id,
      nameKey: this.config.nameKey,
      roleKey: this.config.roleKey,
      charSheet: this.config.charSheet,
      dialogueKey: this.config.dialogueKey,
    });
  }

  public update(playerX: number, playerY: number, time: number): boolean {
    const dist = Math.hypot(playerX - this.config.x, playerY - this.config.y);
    const radius = this.config.interactionRadius ?? 48;
    const wasInRange = this.isPlayerInRange;
    this.isPlayerInRange = dist <= radius;

    // Turn toward player when nearby
    if (dist <= radius + 25) {
      const dx = playerX - this.config.x;
      const dy = playerY - this.config.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          this.sprite.setFlipX(false);
          this.sprite.setFrame(15); // Facing right
        } else {
          this.sprite.setFlipX(true);
          this.sprite.setFrame(15); // Facing left
        }
      } else {
        if (dy > 0) {
          this.sprite.setFlipX(false);
          this.sprite.setFrame(1); // Facing down
        } else {
          this.sprite.setFlipX(false);
          this.sprite.setFrame(8); // Facing up
        }
      }
    } else {
      // Default idle facing down
      this.sprite.setFlipX(false);
      this.sprite.setFrame(1);
    }

    // Toggle and bob prompt bubble
    if (this.isPlayerInRange) {
      if (!wasInRange) {
        this.promptBubble.setVisible(true);
      }
      const bob = Math.sin(time * 0.006) * 2;
      this.promptBubble.y = bob;
    } else if (wasInRange) {
      this.promptBubble.setVisible(false);
    }

    return this.isPlayerInRange;
  }

  private drawPromptBubble(): void {
    const bx = this.config.x;
    const by = this.basePromptY;

    this.promptBubble.clear();

    // Bubble outline & body
    this.promptBubble.fillStyle(0x14110f, 0.9);
    this.promptBubble.fillRoundedRect(bx - 10, by - 10, 20, 18, 4);

    // Tail pointing down
    this.promptBubble.fillTriangle(bx - 3, by + 8, bx + 3, by + 8, bx, by + 12);

    // Inner background
    this.promptBubble.fillStyle(0xf5f2e9, 1);
    this.promptBubble.fillRoundedRect(bx - 8, by - 8, 16, 14, 3);

    // Pixel "E" glyph in terracotta accent color
    this.promptBubble.fillStyle(0xab4c24, 1);
    // Vertical spine
    this.promptBubble.fillRect(bx - 4, by - 5, 2, 8);
    // Top bar
    this.promptBubble.fillRect(bx - 2, by - 5, 5, 2);
    // Mid bar
    this.promptBubble.fillRect(bx - 2, by - 2, 4, 2);
    // Bottom bar
    this.promptBubble.fillRect(bx - 2, by + 1, 5, 2);
  }
}
