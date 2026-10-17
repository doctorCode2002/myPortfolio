import Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

interface CloudInstance {
  sprite: Phaser.GameObjects.Sprite;
  speed: number;
  isForeground?: boolean;
  startX?: number;
  endX?: number;
}

export class CloudSystem {
  private skyBackdrop: Phaser.GameObjects.Image | null = null;
  private skyGraphics: Phaser.GameObjects.Graphics | null = null;
  private clouds: CloudInstance[] = [];
  private isVisible = true;

  constructor(private scene: Phaser.Scene) {
    this.createOrganicCloudTextures();
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

  private createOrganicCloudTextures(): void {
    const configs = [
      {
        key: "fx_cloud_sm",
        w: 96,
        h: 48,
        lobes: [
          { cx: 32, cy: 26, r: 16 },
          { cx: 48, cy: 22, r: 18 },
          { cx: 64, cy: 26, r: 15 },
          { cx: 42, cy: 16, r: 13 },
        ],
      },
      {
        key: "fx_cloud_md",
        w: 136,
        h: 60,
        lobes: [
          { cx: 36, cy: 34, r: 20 },
          { cx: 68, cy: 30, r: 24 },
          { cx: 98, cy: 34, r: 20 },
          { cx: 54, cy: 22, r: 18 },
          { cx: 80, cy: 22, r: 18 },
        ],
      },
      {
        key: "fx_cloud_front",
        w: 110,
        h: 52,
        lobes: [
          { cx: 35, cy: 28, r: 18 },
          { cx: 55, cy: 24, r: 20 },
          { cx: 75, cy: 28, r: 17 },
          { cx: 48, cy: 18, r: 14 },
        ],
      },
    ];

    for (const { key, w, h, lobes } of configs) {
      if (this.scene.textures.exists(key)) continue;
      const canvas = this.scene.textures.createCanvas(key, w, h);
      if (!canvas) continue;

      const ctx = canvas.context;
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let minD = 999;
          let isUnder = false;
          for (const l of lobes) {
            const d = Math.hypot(x - l.cx, y - l.cy) - l.r;
            if (d < minD) {
              minD = d;
              isUnder = y > l.cy + 3;
            }
          }

          const idx = (y * w + x) * 4;
          if (minD < -2.5) {
            data[idx] = isUnder ? 188 : 255;
            data[idx + 1] = isUnder ? 204 : 255;
            data[idx + 2] = isUnder ? 222 : 255;
            data[idx + 3] = 245;
          } else if (minD < 0) {
            data[idx] = isUnder ? 196 : 255;
            data[idx + 1] = isUnder ? 210 : 255;
            data[idx + 2] = isUnder ? 226 : 255;
            data[idx + 3] = 160;
          } else if (minD < 2.0 && (x + y) % 2 === 0) {
            data[idx] = 220;
            data[idx + 1] = 230;
            data[idx + 2] = 242;
            data[idx + 3] = 85;
          } else {
            data[idx + 3] = 0;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      canvas.refresh();
    }
  }

  private spawnCloudLayers(): void {
    const { DEPTHS } = ENGINE_CONSTANTS;
    const bg = [
      { x: 180, y: 140, key: "fx_cloud_sm", speed: 9 },
      { x: 620, y: 210, key: "fx_cloud_md", speed: 11 },
      { x: 1080, y: 125, key: "fx_cloud_sm", speed: 10 },
      { x: 1460, y: 250, key: "fx_cloud_md", speed: 12 },
    ];
    for (const c of bg) {
      const s = this.scene.add.sprite(c.x, c.y, c.key);
      s.setScrollFactor(0.15).setAlpha(0.42).setDepth(DEPTHS.BACKGROUND_CLOUDS);
      this.clouds.push({ sprite: s, speed: c.speed });
    }

    const mid = [
      { x: 100, y: 310, key: "fx_cloud_md", speed: 18 },
      { x: 580, y: 235, key: "fx_cloud_md", speed: 22 },
      { x: 1050, y: 330, key: "fx_cloud_md", speed: 20 },
      { x: 780, y: 860, key: "fx_cloud_md", speed: 21 },
    ];
    for (const c of mid) {
      const s = this.scene.add.sprite(c.x, c.y, c.key);
      s.setScrollFactor(0.35).setAlpha(0.68).setDepth(DEPTHS.MIDGROUND_CLOUDS);
      this.clouds.push({ sprite: s, speed: c.speed });
    }

    // Rare, small, fast-fading front cloud
    const fg = this.scene.add.sprite(350, 490, "fx_cloud_front");
    fg.setScrollFactor(0.55).setAlpha(0.18).setScale(1.1).setDepth(35);
    this.clouds.push({
      sprite: fg,
      speed: 38,
      isForeground: true,
      startX: 150,
      endX: 1150,
    });
  }

  public update(delta: number, reducedMotion = false): void {
    if (reducedMotion || !this.isVisible) return;

    const dt = delta / 1000;
    const wrapBound = ENGINE_CONSTANTS.WORLD_WIDTH + 260;

    for (const cloud of this.clouds) {
      cloud.sprite.x += cloud.speed * dt;

      if (
        cloud.isForeground &&
        cloud.startX !== undefined &&
        cloud.endX !== undefined
      ) {
        // Fast-fading envelope over the island region
        const totalDist = cloud.endX - cloud.startX;
        const progress = (cloud.sprite.x - cloud.startX) / totalDist;
        if (progress >= 0 && progress <= 1) {
          // Smooth fade in / fade out curve
          const alphaFade = Math.sin(progress * Math.PI) * 0.18;
          cloud.sprite.setAlpha(Math.max(0, alphaFade));
        } else {
          cloud.sprite.setAlpha(0);
        }

        if (cloud.sprite.x > cloud.endX + 100) {
          cloud.sprite.x = cloud.startX - 180;
        }
      } else if (cloud.sprite.x > wrapBound) {
        cloud.sprite.x = -240;
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    for (const c of this.clouds) {
      c.sprite.setVisible(visible);
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
