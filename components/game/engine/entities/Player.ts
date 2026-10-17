import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

export type FacingDirection = "down" | "up" | "right" | "left";

export class Player {
  public readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private facing: FacingDirection = "down";

  constructor(scene: Phaser.Scene, startX: number, startY: number) {
    const { PLAYER, DEPTHS } = ENGINE_CONSTANTS;

    // Soft shadow below feet
    this.shadow = scene.add.graphics();
    this.shadow.setDepth(DEPTHS.PLAYER_SHADOW);
    this.shadow.fillStyle(0x000000, 0.28);
    this.shadow.fillEllipse(startX, startY + PLAYER.FEET_OFFSET_Y, 14, 6);

    // Player sprite
    this.sprite = scene.add.sprite(startX, startY, "player", 1);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDepth(DEPTHS.PLAYER);

    this.createAnimations(scene);
  }

  public get x(): number {
    return this.sprite.x;
  }

  public get y(): number {
    return this.sprite.y;
  }

  public move(
    normX: number,
    normY: number,
    dt: number,
    isWalkable: (x: number, y: number) => boolean
  ): void {
    const isMoving = normX !== 0 || normY !== 0;

    if (isMoving) {
      this.updateFacing(normX, normY);

      const speed = ENGINE_CONSTANTS.PLAYER.SPEED;
      const targetX = this.sprite.x + normX * speed * dt;
      const targetY = this.sprite.y + normY * speed * dt;
      const feetY = ENGINE_CONSTANTS.PLAYER.FEET_OFFSET_Y;

      // Wall-sliding edge clamping against walkable island boundary
      if (isWalkable(targetX, targetY + feetY)) {
        this.sprite.x = targetX;
        this.sprite.y = targetY;
      } else {
        if (isWalkable(targetX, this.sprite.y + feetY)) {
          this.sprite.x = targetX;
        }
        if (isWalkable(this.sprite.x, targetY + feetY)) {
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
    if (Math.abs(normX) > Math.abs(normY)) {
      if (normX > 0) {
        this.facing = "right";
        this.sprite.setFlipX(false);
        this.sprite.anims.play("walk-right", true);
      } else {
        this.facing = "left";
        this.sprite.setFlipX(true);
        this.sprite.anims.play("walk-right", true);
      }
    } else {
      if (normY > 0) {
        this.facing = "down";
        this.sprite.setFlipX(false);
        this.sprite.anims.play("walk-down", true);
      } else {
        this.facing = "up";
        this.sprite.setFlipX(false);
        this.sprite.anims.play("walk-up", true);
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

  private createAnimations(scene: Phaser.Scene): void {
    const fps = ENGINE_CONSTANTS.PLAYER.ANIM_FPS;

    // Row 0 = Facing DOWN: walk frames 0, 1, 2, 1 (idle = 1)
    if (!scene.anims.exists("walk-down")) {
      scene.anims.create({
        key: "walk-down",
        frames: scene.anims.generateFrameNumbers("player", {
          frames: [0, 1, 2, 1],
        }),
        frameRate: fps,
        repeat: -1,
      });
    }

    // Row 1 = Facing UP: walk frames 7, 8, 9, 8 (idle = 8)
    if (!scene.anims.exists("walk-up")) {
      scene.anims.create({
        key: "walk-up",
        frames: scene.anims.generateFrameNumbers("player", {
          frames: [7, 8, 9, 8],
        }),
        frameRate: fps,
        repeat: -1,
      });
    }

    // Row 2 = Facing RIGHT: walk frames 14, 15, 16, 15 (idle = 15)
    // Facing LEFT = same frames mirrored via setFlipX(true)
    if (!scene.anims.exists("walk-right")) {
      scene.anims.create({
        key: "walk-right",
        frames: scene.anims.generateFrameNumbers("player", {
          frames: [14, 15, 16, 15],
        }),
        frameRate: fps,
        repeat: -1,
      });
    }
  }
}
