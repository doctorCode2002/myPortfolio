import type Phaser from "phaser";
import { gameEvents } from "../events";
import { InteractionPrompt } from "../world/interactionPrompt";

export interface NpcConfig {
  id: string;
  charSheet: string;
  x: number;
  y: number;
  locale?: string;
  nameKey?: string;
  roleKey?: string;
  dialogueKey?: string;
  title?: string;
  subtitle?: string;
  lines?: string[];
  interactionRadius?: number;
}

export class Npc {
  public readonly config: NpcConfig;
  public readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly prompt: InteractionPrompt;

  private isPlayerInRange = false;
  private basePromptY: number;

  constructor(scene: Phaser.Scene, config: NpcConfig) {
    this.config = {
      interactionRadius: 48,
      ...config,
    };

    const npcDepth = this.config.y + 12;

    // Shadow below NPC feet
    this.shadow = scene.add.graphics();
    this.shadow.setDepth(npcDepth - 1);
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
    this.sprite.setDepth(npcDepth);

    // Make NPC interactive on touch / mouse click
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on("pointerdown", () => {
      if (this.isPlayerInRange) {
        this.interact();
      }
    });

    // Interaction prompt above head ("E" key / Talk)
    this.basePromptY = this.config.y - 28;
    this.prompt = new InteractionPrompt(scene);
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

  public setPosition(x: number, y: number): void {
    this.config.x = x;
    this.config.y = y;
    this.sprite.setPosition(x, y);
    this.shadow.clear();
    this.shadow.fillStyle(0x000000, 0.28);
    this.shadow.fillEllipse(x, y + 12, 14, 6);
    this.shadow.setDepth(y + 11);
    this.sprite.setDepth(y + 12);
    this.basePromptY = y - 28;
  }

  public interact(): void {
    gameEvents.emit("interact:npc", {
      npcId: this.config.id,
      nameKey: this.config.nameKey,
      roleKey: this.config.roleKey,
      charSheet: this.config.charSheet,
      dialogueKey: this.config.dialogueKey,
      title: this.config.title,
      subtitle: this.config.subtitle,
      lines: this.config.lines,
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

    // Toggle and bob prompt
    if (this.isPlayerInRange) {
      const text = this.config.locale === "ar" ? "تحدث" : "Talk";
      this.prompt.showPrompt(this.config.x, this.basePromptY - 4, text, () =>
        this.interact()
      );
      this.prompt.updateBob(time);
    } else if (wasInRange) {
      this.prompt.hide();
    }

    return this.isPlayerInRange;
  }

  public destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.prompt.destroy();
  }
}
