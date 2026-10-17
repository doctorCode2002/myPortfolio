import Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

interface Tuft {
  sprite: Phaser.GameObjects.Sprite;
  baseX: number;
  baseY: number;
  phase: number;
}

export class GrassSystem {
  private tufts: Tuft[] = [];
  private readonly textureKey = "fx_grass_tufts";

  constructor(private scene: Phaser.Scene) {
    this.createProceduralTexture();
  }

  private createProceduralTexture(): void {
    if (this.scene.textures.exists(this.textureKey)) return;

    // 3 frames side by side on an 18x6 canvas: [0]=idle, [1]=sway right, [2]=sway left
    const canvas = this.scene.textures.createCanvas(this.textureKey, 18, 6);
    if (!canvas) return;

    const ctx = canvas.context;
    ctx.imageSmoothingEnabled = false;

    // Colors
    const baseCol = "#1d581a";
    const midCol = "#3ea62c";
    const tipCol = "#75d65c";

    // Frame 0: Idle upright (x: 0..5)
    ctx.fillStyle = baseCol;
    ctx.fillRect(2, 4, 2, 2);
    ctx.fillStyle = midCol;
    ctx.fillRect(1, 2, 1, 2);
    ctx.fillRect(2, 2, 2, 2);
    ctx.fillRect(4, 2, 1, 2);
    ctx.fillStyle = tipCol;
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(2, 0, 2, 2);
    ctx.fillRect(4, 1, 1, 1);

    // Frame 1: Swayed right (x: 6..11)
    ctx.fillStyle = baseCol;
    ctx.fillRect(6 + 2, 4, 2, 2);
    ctx.fillStyle = midCol;
    ctx.fillRect(6 + 2, 2, 2, 2);
    ctx.fillRect(6 + 4, 2, 1, 2);
    ctx.fillRect(6 + 5, 2, 1, 2);
    ctx.fillStyle = tipCol;
    ctx.fillRect(6 + 3, 1, 1, 1);
    ctx.fillRect(6 + 4, 0, 1, 2);
    ctx.fillRect(6 + 5, 1, 1, 1);

    // Frame 2: Swayed left (x: 12..17)
    ctx.fillStyle = baseCol;
    ctx.fillRect(12 + 2, 4, 2, 2);
    ctx.fillStyle = midCol;
    ctx.fillRect(12 + 0, 2, 1, 2);
    ctx.fillRect(12 + 1, 2, 1, 2);
    ctx.fillRect(12 + 2, 2, 2, 2);
    ctx.fillStyle = tipCol;
    ctx.fillRect(12 + 0, 1, 1, 1);
    ctx.fillRect(12 + 1, 0, 1, 2);
    ctx.fillRect(12 + 2, 1, 1, 1);

    canvas.refresh();

    const tex = this.scene.textures.get(this.textureKey);
    tex.add("tuft_0", 0, 0, 0, 6, 6);
    tex.add("tuft_1", 0, 6, 0, 6, 6);
    tex.add("tuft_2", 0, 12, 0, 6, 6);
  }

  public populate(
    worldX: number,
    worldY: number,
    materialKey = "dev-island-material"
  ): void {
    this.clear();

    const points: Array<{ x: number; y: number }> = [];
    const minSpacing = 28;

    // Sample across top surface region (walkable grass area of island)
    // Home island bounds in native pixels: x: 80..720, y: 440..750
    for (let gy = 440; gy <= 750; gy += 32) {
      for (let gx = 90; gx <= 710; gx += 32) {
        const jx = gx + Math.floor((Math.random() - 0.5) * 18);
        const jy = gy + Math.floor((Math.random() - 0.5) * 18);

        let isGrassPixel = false;
        if (this.scene.textures.exists(materialKey)) {
          const col = this.scene.textures.getPixel(jx, jy, materialKey);
          if (col && col.green > 150 && col.red < 50 && col.blue < 50) {
            isGrassPixel = true;
          }
        } else {
          // Fallback check if material map is not yet ready
          isGrassPixel = Math.random() > 0.4;
        }

        if (isGrassPixel) {
          const wx = worldX + jx;
          const wy = worldY + jy;

          const tooClose = points.some(
            (p) => Math.hypot(p.x - wx, p.y - wy) < minSpacing
          );
          if (!tooClose) {
            points.push({ x: wx, y: wy });
          }
        }
      }
    }

    // Spawn sprites for sampled points
    for (const p of points) {
      const sprite = this.scene.add.sprite(p.x, p.y, this.textureKey, "tuft_0");
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(ENGINE_CONSTANTS.DEPTHS.GRASS + 1);

      this.tufts.push({
        sprite,
        baseX: p.x,
        baseY: p.y,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public update(
    time: number,
    playerX?: number,
    playerY?: number,
    reducedMotion = false
  ): void {
    if (reducedMotion) {
      for (const t of this.tufts) {
        t.sprite.setFrame("tuft_0");
      }
      return;
    }

    const tSec = time * 0.001;

    for (const tuft of this.tufts) {
      // Player parting check
      if (playerX !== undefined && playerY !== undefined) {
        const dist = Math.hypot(playerX - tuft.baseX, playerY - tuft.baseY);
        if (dist < 18) {
          // Part away from player
          if (playerX > tuft.baseX) {
            tuft.sprite.setFrame("tuft_2"); // Part left
          } else {
            tuft.sprite.setFrame("tuft_1"); // Part right
          }
          continue;
        }
      }

      // Wind wave sway across the world
      const wind = Math.sin(tSec * 2.2 + tuft.baseX * 0.012 + tuft.phase);
      if (wind > 0.45) {
        tuft.sprite.setFrame("tuft_1");
      } else if (wind < -0.45) {
        tuft.sprite.setFrame("tuft_2");
      } else {
        tuft.sprite.setFrame("tuft_0");
      }
    }
  }

  public clear(): void {
    for (const t of this.tufts) {
      t.sprite.destroy();
    }
    this.tufts = [];
  }

  public destroy(): void {
    this.clear();
  }
}
