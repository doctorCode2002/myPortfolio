import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

export class ControlsManager {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private joystickActive = false;
  private joystickOrigin = { x: 0, y: 0 };
  private joystickVector = { x: 0, y: 0 };
  private joystickBase: Phaser.GameObjects.Graphics;
  private joystickThumb: Phaser.GameObjects.Graphics;
  private tapTarget: { x: number; y: number } | null = null;
  private tapMarker: Phaser.GameObjects.Graphics;

  private isFrozen = false;
  private wasInteractDown = false;

  constructor(private scene: Phaser.Scene) {
    const { DEPTHS } = ENGINE_CONSTANTS;

    this.joystickBase = scene.add.graphics();
    this.joystickBase.setScrollFactor(0);
    this.joystickBase.setDepth(DEPTHS.TOUCH_UI);
    this.joystickBase.setVisible(false);

    this.joystickThumb = scene.add.graphics();
    this.joystickThumb.setScrollFactor(0);
    this.joystickThumb.setDepth(DEPTHS.TOUCH_UI + 1);
    this.joystickThumb.setVisible(false);

    this.tapMarker = scene.add.graphics();
    this.tapMarker.setDepth(DEPTHS.DETAILS);
    this.tapMarker.setVisible(false);

    this.setupKeyboard(scene);
    this.setupPointer(scene);
  }

  public setFrozen(frozen: boolean): void {
    this.isFrozen = frozen;
    if (frozen) {
      this.tapTarget = null;
      this.joystickActive = false;
      this.joystickVector = { x: 0, y: 0 };
      this.joystickBase.setVisible(false);
      this.joystickThumb.setVisible(false);
    }
  }

  public isInteractTriggered(): boolean {
    if (this.isFrozen) {
      this.wasInteractDown = false;
      return false;
    }
    const isDown = Boolean(
      this.keys["e"]?.isDown ||
      this.keys["E"]?.isDown ||
      this.keys["space"]?.isDown ||
      this.keys["SPACE"]?.isDown ||
      this.keys["enter"]?.isDown ||
      this.keys["ENTER"]?.isDown
    );
    const triggered = isDown && !this.wasInteractDown;
    this.wasInteractDown = isDown;
    return triggered;
  }

  public getMovementVector(
    playerX: number,
    playerY: number,
    isWalkable: (x: number, y: number) => boolean
  ): { normX: number; normY: number } {
    if (this.isFrozen) return { normX: 0, normY: 0 };

    let moveX = 0;
    let moveY = 0;

    // Continuous keyboard polling via isDown state each frame
    if (this.keys["left"]?.isDown || this.keys["a"]?.isDown) moveX -= 1;
    if (this.keys["right"]?.isDown || this.keys["d"]?.isDown) moveX += 1;
    if (this.keys["up"]?.isDown || this.keys["w"]?.isDown) moveY -= 1;
    if (this.keys["down"]?.isDown || this.keys["s"]?.isDown) moveY += 1;

    if (moveX !== 0 || moveY !== 0) {
      this.tapTarget = null;
    }

    // Touch joystick input
    if (
      this.joystickActive &&
      (this.joystickVector.x !== 0 || this.joystickVector.y !== 0)
    ) {
      moveX = this.joystickVector.x;
      moveY = this.joystickVector.y;
      this.tapTarget = null;
    }

    // Tap-to-move destination following
    if (this.tapTarget && moveX === 0 && moveY === 0) {
      const toX = this.tapTarget.x - playerX;
      const toY = this.tapTarget.y - playerY;
      const dist = Math.hypot(toX, toY);

      if (dist > 4 && isWalkable(this.tapTarget.x, this.tapTarget.y)) {
        moveX = toX / dist;
        moveY = toY / dist;
      } else {
        this.tapTarget = null;
      }
    }

    // Strict diagonal normalization so diagonal movement is never faster
    const mag = Math.hypot(moveX, moveY);
    if (mag > 0) {
      return { normX: moveX / mag, normY: moveY / mag };
    }

    return { normX: 0, normY: 0 };
  }

  private setupKeyboard(scene: Phaser.Scene): void {
    if (scene.input.keyboard) {
      this.keys = scene.input.keyboard.addKeys({
        up: "UP",
        down: "DOWN",
        left: "LEFT",
        right: "RIGHT",
        w: "W",
        s: "S",
        a: "A",
        d: "D",
        e: "E",
        space: "SPACE",
        enter: "ENTER",
      }) as Record<string, Phaser.Input.Keyboard.Key>;
    }
  }

  private setupPointer(scene: Phaser.Scene): void {
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const target = pointer.event.target as HTMLElement | null;
      if (target && target.closest(".pointer-events-auto")) return;

      this.joystickActive = true;
      this.joystickOrigin = { x: pointer.x, y: pointer.y };
      this.joystickVector = { x: 0, y: 0 };

      this.drawJoystick(pointer.x, pointer.y, pointer.x, pointer.y);
      this.joystickBase.setVisible(true);
      this.joystickThumb.setVisible(true);
    });

    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.joystickActive || !pointer.isDown) return;

      const dx = pointer.x - this.joystickOrigin.x;
      const dy = pointer.y - this.joystickOrigin.y;
      const dist = Math.hypot(dx, dy);
      const maxRadius = 38;

      if (dist > 6) {
        this.tapTarget = null;
        if (this.tapMarker) this.tapMarker.setVisible(false);

        const clamped = Math.min(dist, maxRadius);
        const thumbX = this.joystickOrigin.x + (dx / dist) * clamped;
        const thumbY = this.joystickOrigin.y + (dy / dist) * clamped;

        this.joystickVector = { x: dx / dist, y: dy / dist };
        this.drawJoystick(
          this.joystickOrigin.x,
          this.joystickOrigin.y,
          thumbX,
          thumbY
        );
      }
    });

    scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.joystickActive) return;

      const dx = pointer.x - this.joystickOrigin.x;
      const dy = pointer.y - this.joystickOrigin.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= 8) {
        const worldPoint = this.scene.cameras.main.getWorldPoint(
          pointer.x,
          pointer.y
        );
        this.tapTarget = { x: worldPoint.x, y: worldPoint.y };
        this.showTapRipple(worldPoint.x, worldPoint.y);
      }

      this.joystickActive = false;
      this.joystickVector = { x: 0, y: 0 };
      this.joystickBase.setVisible(false);
      this.joystickThumb.setVisible(false);
    });
  }

  private drawJoystick(bx: number, by: number, tx: number, ty: number): void {
    this.joystickBase.clear();
    this.joystickBase.fillStyle(0xffffff, 0.18);
    this.joystickBase.fillCircle(bx, by, 38);
    this.joystickBase.lineStyle(2, 0xffffff, 0.45);
    this.joystickBase.strokeCircle(bx, by, 38);

    this.joystickThumb.clear();
    this.joystickThumb.fillStyle(0xffffff, 0.7);
    this.joystickThumb.fillCircle(tx, ty, 16);
    this.joystickThumb.lineStyle(2, 0xab4c24, 0.8);
    this.joystickThumb.strokeCircle(tx, ty, 16);
  }

  private showTapRipple(x: number, y: number): void {
    this.tapMarker.clear();
    this.tapMarker.lineStyle(2, 0xffffff, 0.8);
    this.tapMarker.strokeCircle(x, y, 8);
    this.tapMarker.setVisible(true);

    this.scene.tweens.add({
      targets: this.tapMarker,
      alpha: { from: 1, to: 0 },
      scale: { from: 1, to: 1.8 },
      duration: 350,
      onComplete: () => {
        this.tapMarker.setVisible(false);
        this.tapMarker.setAlpha(1);
        this.tapMarker.setScale(1);
      },
    });
  }
}
