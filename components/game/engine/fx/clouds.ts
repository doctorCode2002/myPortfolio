import Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

interface CloudInstance {
  sprite: Phaser.GameObjects.Sprite;
  speed: number;
}

export class CloudSystem {
  private skyBackdrop: Phaser.GameObjects.Image | null = null;
  private skyGraphics: Phaser.GameObjects.Graphics | null = null;
  private clouds: CloudInstance[] = [];

  constructor(private scene: Phaser.Scene) {
    this.createCloudTextures();
    this.createSkyBackdrop();
    this.spawnCloudLayers();
  }

  private createSkyBackdrop(): void {
    const { WORLD_WIDTH, WORLD_HEIGHT, DEPTHS } = ENGINE_CONSTANTS;

    if (this.scene.textures.exists("sky-backdrop")) {
      this.skyBackdrop = this.scene.add.image(
        WORLD_WIDTH / 2,
        WORLD_HEIGHT / 2,
        "sky-backdrop"
      );
      this.skyBackdrop.setOrigin(0.5, 0.5);
      this.skyBackdrop.setScrollFactor(0.05);
      this.skyBackdrop.setDepth(DEPTHS.SKY);
      // Scale to comfortably cover world boundaries
      const scaleX = (WORLD_WIDTH + 800) / this.skyBackdrop.width;
      const scaleY = (WORLD_HEIGHT + 800) / this.skyBackdrop.height;
      this.skyBackdrop.setScale(Math.max(scaleX, scaleY));
    } else {
      this.skyGraphics = this.scene.add.graphics();
      this.skyGraphics.setScrollFactor(0.05);
      this.skyGraphics.setDepth(DEPTHS.SKY);
      this.renderGradient();
    }
  }

  private renderGradient(): void {
    if (!this.skyGraphics) return;
    const { WORLD_WIDTH, WORLD_HEIGHT } = ENGINE_CONSTANTS;
    this.skyGraphics.clear();
    // Warm top-down celestial gradient
    this.skyGraphics.fillGradientStyle(
      0x477299,
      0x477299,
      0xe5d8c3,
      0xe5d8c3,
      1,
      1,
      1,
      1
    );
    this.skyGraphics.fillRect(
      -1000,
      -1000,
      WORLD_WIDTH + 2000,
      WORLD_HEIGHT + 2000
    );
  }

  private createCloudTextures(): void {
    const configs = [
      { key: "fx_cloud_sm", w: 100, h: 50 },
      { key: "fx_cloud_md", w: 145, h: 68 },
      { key: "fx_cloud_lg", w: 195, h: 84 },
    ];

    for (const { key, w, h } of configs) {
      if (this.scene.textures.exists(key)) continue;

      const canvas = this.scene.textures.createCanvas(key, w, h);
      if (!canvas) continue;

      const ctx = canvas.context;
      const cx = w / 2;
      const cy = h / 2 + 4;

      // Soft shaded underside
      ctx.fillStyle = "rgba(182, 198, 218, 0.85)";
      this.drawPuffs(ctx, cx, cy + 4, w * 0.42, h * 0.35);

      // Bright body
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      this.drawPuffs(ctx, cx, cy, w * 0.38, h * 0.32);

      canvas.refresh();
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

  private spawnCloudLayers(): void {
    const { WORLD_HEIGHT, DEPTHS } = ENGINE_CONSTANTS;

    // Layer 1: Distant background clouds
    const bg = [
      { x: 180, y: 140, key: "fx_cloud_sm", speed: 9 },
      { x: 620, y: 210, key: "fx_cloud_md", speed: 11 },
      { x: 1080, y: 125, key: "fx_cloud_sm", speed: 10 },
      { x: 1460, y: 250, key: "fx_cloud_md", speed: 12 },
      { x: 380, y: 370, key: "fx_cloud_sm", speed: 9 },
      { x: 920, y: 410, key: "fx_cloud_md", speed: 10 },
    ];
    for (const c of bg) {
      const sprite = this.scene.add.sprite(c.x, c.y, c.key);
      sprite.setScrollFactor(0.15);
      sprite.setAlpha(0.42);
      sprite.setScale(1.2);
      sprite.setDepth(DEPTHS.BACKGROUND_CLOUDS);
      this.clouds.push({ sprite, speed: c.speed });
    }

    // Layer 2: Midground clouds
    const mid = [
      { x: 80, y: 310, key: "fx_cloud_md", speed: 18 },
      { x: 480, y: 235, key: "fx_cloud_lg", speed: 22 },
      { x: 900, y: 330, key: "fx_cloud_lg", speed: 20 },
      { x: 1330, y: 275, key: "fx_cloud_md", speed: 24 },
      { x: 280, y: 760, key: "fx_cloud_lg", speed: 19 },
      { x: 780, y: 860, key: "fx_cloud_md", speed: 21 },
      { x: 1280, y: 800, key: "fx_cloud_lg", speed: 23 },
    ];
    for (const c of mid) {
      const sprite = this.scene.add.sprite(c.x, c.y, c.key);
      sprite.setScrollFactor(0.35);
      sprite.setAlpha(0.7);
      sprite.setScale(1.6);
      sprite.setDepth(DEPTHS.MIDGROUND_CLOUDS);
      this.clouds.push({ sprite, speed: c.speed });
    }

    // Layer 3: Foreground clouds drifting IN FRONT of the islands at low opacity
    const fg = [
      { x: 220, y: 460, key: "fx_cloud_lg", speed: 32 },
      { x: 740, y: 580, key: "fx_cloud_lg", speed: 36 },
      { x: 1250, y: 420, key: "fx_cloud_lg", speed: 34 },
      { x: 450, y: WORLD_HEIGHT - 220, key: "fx_cloud_lg", speed: 30 },
      { x: 1050, y: WORLD_HEIGHT - 180, key: "fx_cloud_lg", speed: 35 },
    ];
    for (const c of fg) {
      const sprite = this.scene.add.sprite(c.x, c.y, c.key);
      sprite.setScrollFactor(0.55);
      sprite.setAlpha(0.22); // Low opacity as required by spec
      sprite.setScale(2.5);
      sprite.setDepth(35); // Above island (depth 10) and player (depth 20)
      this.clouds.push({ sprite, speed: c.speed });
    }
  }

  public update(delta: number, reducedMotion = false): void {
    if (reducedMotion) return;

    const dt = delta / 1000;
    const wrapBound = ENGINE_CONSTANTS.WORLD_WIDTH + 300;

    for (const cloud of this.clouds) {
      cloud.sprite.x += cloud.speed * dt;
      if (cloud.sprite.x > wrapBound) {
        cloud.sprite.x = -280;
      }
    }
  }

  public resize(): void {
    this.renderGradient();
  }

  public destroy(): void {
    this.skyBackdrop?.destroy();
    this.skyGraphics?.destroy();
    for (const c of this.clouds) {
      c.sprite.destroy();
    }
    this.clouds = [];
  }
}
