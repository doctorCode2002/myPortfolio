import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

interface CloudEntity {
  sprite: Phaser.GameObjects.Sprite;
  speed: number;
}

export class SkySystem {
  private skyGraphics: Phaser.GameObjects.Graphics;
  private clouds: CloudEntity[] = [];

  constructor(private scene: Phaser.Scene) {
    this.createProceduralTextures();

    this.skyGraphics = scene.add.graphics();
    this.skyGraphics.setDepth(ENGINE_CONSTANTS.DEPTHS.SKY);
    this.renderGradient();

    this.spawnClouds();
  }

  public resize(): void {
    this.renderGradient();
  }

  public update(delta: number): void {
    const dt = delta / 1000;
    const wrapBound = ENGINE_CONSTANTS.WORLD_WIDTH + 260;

    for (const cloud of this.clouds) {
      cloud.sprite.x += cloud.speed * dt;
      if (cloud.sprite.x > wrapBound) {
        cloud.sprite.x = -240;
      }
    }
  }

  private renderGradient(): void {
    const { WORLD_WIDTH, WORLD_HEIGHT } = ENGINE_CONSTANTS;
    this.skyGraphics.clear();
    // Soft celestial gradient covering full world space plus generous borders
    this.skyGraphics.fillGradientStyle(
      0x507ea8,
      0x507ea8,
      0xe8e2d8,
      0xe8e2d8,
      1,
      1,
      1,
      1
    );
    this.skyGraphics.fillRect(
      -800,
      -800,
      WORLD_WIDTH + 1600,
      WORLD_HEIGHT + 1600
    );
  }

  private createProceduralTextures(): void {
    const configs = [
      { key: "cloud_sm", w: 100, h: 50 },
      { key: "cloud_md", w: 140, h: 65 },
      { key: "cloud_lg", w: 190, h: 80 },
    ];

    for (const { key, w, h } of configs) {
      if (!this.scene.textures.exists(key)) {
        const canvas = this.scene.textures.createCanvas(key, w, h);
        if (canvas) {
          const ctx = canvas.context;
          const cx = w / 2;
          const cy = h / 2 + 5;

          // Shadow underside
          ctx.fillStyle = "rgba(180, 198, 218, 0.85)";
          this.drawPuffs(ctx, cx, cy + 4, w * 0.42, h * 0.35);

          // White body
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          this.drawPuffs(ctx, cx, cy, w * 0.38, h * 0.32);

          canvas.refresh();
        }
      }
    }
  }

  private drawPuffs(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number
  ): void {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.ellipse(
      cx - rx * 0.5,
      cy + ry * 0.1,
      rx * 0.65,
      ry * 0.7,
      0,
      0,
      Math.PI * 2
    );
    ctx.ellipse(
      cx + rx * 0.5,
      cy + ry * 0.1,
      rx * 0.65,
      ry * 0.7,
      0,
      0,
      Math.PI * 2
    );
    ctx.ellipse(
      cx - rx * 0.2,
      cy - ry * 0.3,
      rx * 0.6,
      ry * 0.65,
      0,
      0,
      Math.PI * 2
    );
    ctx.ellipse(
      cx + rx * 0.25,
      cy - ry * 0.25,
      rx * 0.55,
      ry * 0.6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  private spawnClouds(): void {
    const { WORLD_HEIGHT, DEPTHS } = ENGINE_CONSTANTS;

    // Layer 1: Distant background clouds
    const bg = [
      { x: 200, y: 150, key: "cloud_sm", speed: 8 },
      { x: 650, y: 220, key: "cloud_md", speed: 10 },
      { x: 1100, y: 130, key: "cloud_sm", speed: 9 },
      { x: 1450, y: 260, key: "cloud_md", speed: 11 },
      { x: 400, y: 380, key: "cloud_sm", speed: 9 },
      { x: 950, y: 420, key: "cloud_md", speed: 8 },
    ];
    for (const c of bg) {
      const sprite = this.scene.add.sprite(c.x, c.y, c.key);
      sprite.setScrollFactor(0.15);
      sprite.setAlpha(0.45);
      sprite.setScale(1.2);
      sprite.setDepth(DEPTHS.BACKGROUND_CLOUDS);
      this.clouds.push({ sprite, speed: c.speed });
    }

    // Layer 2: Midground clouds
    const mid = [
      { x: 100, y: 320, key: "cloud_md", speed: 18 },
      { x: 500, y: 240, key: "cloud_lg", speed: 22 },
      { x: 920, y: 340, key: "cloud_lg", speed: 20 },
      { x: 1350, y: 280, key: "cloud_md", speed: 24 },
      { x: 300, y: 780, key: "cloud_lg", speed: 19 },
      { x: 800, y: 880, key: "cloud_md", speed: 21 },
      { x: 1300, y: 820, key: "cloud_lg", speed: 23 },
    ];
    for (const c of mid) {
      const sprite = this.scene.add.sprite(c.x, c.y, c.key);
      sprite.setScrollFactor(0.35);
      sprite.setAlpha(0.75);
      sprite.setScale(1.6);
      sprite.setDepth(DEPTHS.MIDGROUND_CLOUDS);
      this.clouds.push({ sprite, speed: c.speed });
    }

    // Layer 3: Faint lower foreground clouds
    const fg = [
      { x: 250, y: WORLD_HEIGHT - 200, key: "cloud_lg", speed: 32 },
      { x: 850, y: WORLD_HEIGHT - 160, key: "cloud_lg", speed: 36 },
      { x: 1400, y: WORLD_HEIGHT - 220, key: "cloud_lg", speed: 30 },
    ];
    for (const c of fg) {
      const sprite = this.scene.add.sprite(c.x, c.y, c.key);
      sprite.setScrollFactor(0.55);
      sprite.setAlpha(0.25);
      sprite.setScale(2.4);
      sprite.setDepth(DEPTHS.FOREGROUND_CLOUDS);
      this.clouds.push({ sprite, speed: c.speed });
    }
  }
}
