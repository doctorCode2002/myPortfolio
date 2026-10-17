import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

export type FacingDirection = "down" | "up" | "right" | "left";

export class Player {
  public readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private facing: FacingDirection = "down";
  private charSheet: string;
  private isFrozen = false;

  constructor(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    initialCharSheet = "char_0"
  ) {
    const { PLAYER, DEPTHS } = ENGINE_CONSTANTS;
    this.charSheet = initialCharSheet;

    // Soft shadow below feet
    this.shadow = scene.add.graphics();
    this.shadow.setDepth(DEPTHS.PLAYER_SHADOW);
    this.shadow.fillStyle(0x000000, 0.28);
    this.shadow.fillEllipse(startX, startY + PLAYER.FEET_OFFSET_Y, 14, 6);

    // Player sprite
    this.sprite = scene.add.sprite(startX, startY, this.charSheet, 1);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDepth(DEPTHS.PLAYER);

    this.ensureAnimations(scene, this.charSheet);
  }

  public get x(): number {
    return this.sprite.x;
  }

  public get y(): number {
    return this.sprite.y;
  }

  public setFrozen(frozen: boolean): void {
    this.isFrozen = frozen;
    if (frozen) {
      this.setIdle();
    }
  }

  public setCharacterSheet(scene: Phaser.Scene, newSheet: string): void {
    this.charSheet = newSheet;
    this.ensureAnimations(scene, newSheet);
    this.sprite.setTexture(newSheet);
    this.setIdle();
  }

  public move(
    normX: number,
    normY: number,
    dt: number,
    isWalkable: (x: number, y: number) => boolean,
    isObstacle?: (x: number, y: number) => boolean
  ): void {
    if (this.isFrozen) {
      this.setIdle();
      return;
    }

    const isMoving = normX !== 0 || normY !== 0;

    if (isMoving) {
      this.updateFacing(normX, normY);

      const speed = ENGINE_CONSTANTS.PLAYER.SPEED;
      const targetX = this.sprite.x + normX * speed * dt;
      const targetY = this.sprite.y + normY * speed * dt;
      const feetY = ENGINE_CONSTANTS.PLAYER.FEET_OFFSET_Y;

      const canPass = (x: number, y: number): boolean => {
        return isWalkable(x, y) && (!isObstacle || !isObstacle(x, y));
      };

      // Wall-sliding edge & obstacle collision
      if (canPass(targetX, targetY + feetY)) {
        this.sprite.x = targetX;
        this.sprite.y = targetY;
      } else {
        if (canPass(targetX, this.sprite.y + feetY)) {
          this.sprite.x = targetX;
        }
        if (canPass(this.sprite.x, targetY + feetY)) {
          this.sprite.y = targetY;
        }
      }
    } else {
      this.setIdle();
    }

    // Keep shadow aligned under character feet
    this.shadow.x = this.sprite.x - ENGINE_CONSTANTS.PLAYER.START_X;
    this.shadow.y = this.sprite.y - ENGINE_CONSTANTS.PLAYER.START_Y;
  }

  private updateFacing(normX: number, normY: number): void {
    const downKey = `walk-down-${this.charSheet}`;
    const upKey = `walk-up-${this.charSheet}`;
    const rightKey = `walk-right-${this.charSheet}`;

    if (Math.abs(normX) > Math.abs(normY)) {
      if (normX > 0) {
        this.facing = "right";
        this.sprite.setFlipX(false);
        this.sprite.anims.play(rightKey, true);
      } else {
        this.facing = "left";
        this.sprite.setFlipX(true);
        this.sprite.anims.play(rightKey, true);
      }
    } else {
      if (normY > 0) {
        this.facing = "down";
        this.sprite.setFlipX(false);
        this.sprite.anims.play(downKey, true);
      } else {
        this.facing = "up";
        this.sprite.setFlipX(false);
        this.sprite.anims.play(upKey, true);
      }
    }
  }

  private setIdle(): void {
    this.sprite.anims.stop();
    switch (this.facing) {
      case "down":
        this.sprite.setFrame(1);
        this.sprite.setFlipX(false);
        break;
      case "up":
        this.sprite.setFrame(8);
        this.sprite.setFlipX(false);
        break;
      case "right":
        this.sprite.setFrame(15);
        this.sprite.setFlipX(false);
        break;
      case "left":
        this.sprite.setFrame(15);
        this.sprite.setFlipX(true);
        break;
    }
  }

  private ensureAnimations(scene: Phaser.Scene, sheet: string): void {
    const fps = ENGINE_CONSTANTS.PLAYER.ANIM_FPS;
    const downKey = `walk-down-${sheet}`;
    const upKey = `walk-up-${sheet}`;
    const rightKey = `walk-right-${sheet}`;

    if (!scene.anims.exists(downKey)) {
      scene.anims.create({
        key: downKey,
        frames: scene.anims.generateFrameNumbers(sheet, {
          frames: [0, 1, 2, 1],
        }),
        frameRate: fps,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(upKey)) {
      scene.anims.create({
        key: upKey,
        frames: scene.anims.generateFrameNumbers(sheet, {
          frames: [7, 8, 9, 8],
        }),
        frameRate: fps,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(rightKey)) {
      scene.anims.create({
        key: rightKey,
        frames: scene.anims.generateFrameNumbers(sheet, {
          frames: [14, 15, 16, 15],
        }),
        frameRate: fps,
        repeat: -1,
      });
    }
  }
}
