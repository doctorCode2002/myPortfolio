import Phaser from "phaser";

export class InteractionPrompt extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private keyBg: Phaser.GameObjects.Graphics;
  private keyText: Phaser.GameObjects.Text;
  private labelText: Phaser.GameObjects.Text;
  private baseY = 0;
  private onInteractCallback: (() => void) | undefined;
  private currentText = "";

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.bg = scene.add.graphics();
    this.keyBg = scene.add.graphics();

    this.keyText = scene.add.text(0, 0, "E", {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#ab4c24",
    });
    this.keyText.setOrigin(0.5, 0.5);

    this.labelText = scene.add.text(0, 0, "", {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#f5f2e9",
    });
    this.labelText.setOrigin(0, 0.5);

    this.add([this.bg, this.keyBg, this.keyText, this.labelText]);
    this.setDepth(15000);
    this.setVisible(false);

    // Make prompt tappable / clickable on touch devices
    this.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.onInteractCallback?.();
    });

    scene.add.existing(this);
  }

  public showPrompt(
    x: number,
    y: number,
    text: string,
    onInteract?: () => void
  ): void {
    this.baseY = y;
    this.x = x;
    if (!this.visible) {
      this.y = y;
    }
    this.onInteractCallback = onInteract;

    if (this.currentText !== text || !this.visible) {
      this.currentText = text;
      this.labelText.setText(text);

      const padLeft = 6;
      const keySize = 14;
      const gap = 5;
      const padRight = 8;
      const textWidth = Math.ceil(this.labelText.width);
      const totalWidth = padLeft + keySize + gap + textWidth + padRight;
      const totalHeight = 22;

      const startX = -totalWidth / 2;

      // Draw main pill background
      this.bg.clear();
      this.bg.fillStyle(0x14110f, 0.92);
      this.bg.lineStyle(1, 0x44403c, 0.85);
      this.bg.fillRoundedRect(
        startX,
        -totalHeight / 2,
        totalWidth,
        totalHeight,
        5
      );
      this.bg.strokeRoundedRect(
        startX,
        -totalHeight / 2,
        totalWidth,
        totalHeight,
        5
      );

      // Downward pointer arrow
      this.bg.fillTriangle(
        -4,
        totalHeight / 2,
        4,
        totalHeight / 2,
        0,
        totalHeight / 2 + 4
      );

      // Key badge background
      const keyX = startX + padLeft;
      const keyY = -keySize / 2;
      this.keyBg.clear();
      this.keyBg.fillStyle(0xf5f2e9, 1);
      this.keyBg.fillRoundedRect(keyX, keyY, keySize, keySize, 3);

      // Center key letter "E"
      this.keyText.setPosition(keyX + keySize / 2, 0);

      // Position label text
      this.labelText.setPosition(keyX + keySize + gap, 0);

      // Interactive hit area
      this.setSize(totalWidth, totalHeight + 8);
      this.setInteractive({ useHandCursor: true });
    }

    this.setVisible(true);
  }

  public updateBob(time: number): void {
    if (this.visible) {
      this.y = this.baseY + Math.sin(time * 0.006) * 2;
    }
  }

  public hide(): void {
    if (this.visible) {
      this.setVisible(false);
      this.disableInteractive();
    }
  }
}
