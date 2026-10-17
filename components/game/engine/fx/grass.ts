import Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

interface Tuft {
  sprite: Phaser.GameObjects.Sprite;
  baseX: number;
  baseY: number;
  phase: number;
  variant: number;
}

export class GrassSystem {
  private tufts: Tuft[] = [];
  private isVisible = true;
  private readonly textureKey = "fx_grass_tufts_v2";

  constructor(private scene: Phaser.Scene) {
    this.createProceduralTexture();
  }

  private createProceduralTexture(): void {
    if (this.scene.textures.exists(this.textureKey)) return;

    // 3 variants x 3 frames = 9 frames total, each 9x8 px on an 81x8 canvas
    // Variants: 0=standard island olive, 1=shady olive, 2=sunlit olive
    const canvas = this.scene.textures.createCanvas(this.textureKey, 81, 8);
    if (!canvas) return;

    const ctx = canvas.context;
    ctx.imageSmoothingEnabled = false;

    const variants = [
      { base: "#445c2a", mid: "#6a8647", tip: "#8ea956" }, // Standard island grass
      { base: "#354c20", mid: "#556f38", tip: "#748d48" }, // Deep meadow
      { base: "#506c30", mid: "#789750", tip: "#9cbd64" }, // Sunlit meadow
    ];

    const drawFrame = (
      ox: number,
      shear: number,
      pal: { base: string; mid: string; tip: string }
    ) => {
      ctx.fillStyle = pal.base;
      ctx.fillRect(ox + 3, 6, 3, 2); // Anchored base

      ctx.fillStyle = pal.mid;
      ctx.fillRect(ox + 2, 5, 1, 1);
      ctx.fillRect(ox + 4, 5, 1, 1);
      ctx.fillRect(ox + 6, 5, 1, 1);
      ctx.fillRect(ox + 2 + (shear > 0 ? 1 : shear < 0 ? -1 : 0), 4, 1, 1);
      ctx.fillRect(ox + 4 + shear, 4, 1, 2);
      ctx.fillRect(ox + 6 + (shear > 0 ? 1 : shear < 0 ? -1 : 0), 4, 1, 1);
      ctx.fillRect(ox + 2 + (shear > 0 ? 1 : shear < 0 ? -1 : 0), 3, 1, 1);

      ctx.fillStyle = pal.tip;
      ctx.fillRect(ox + 1 + (shear > 0 ? 2 : shear < 0 ? -1 : 0), 2, 1, 1);
      ctx.fillRect(ox + 4 + shear * 2, 1, 1, 2);
      ctx.fillRect(ox + 7 + (shear > 0 ? 1 : shear < 0 ? -2 : 0), 3, 1, 1);
    };

    variants.forEach((pal, v) => {
      const offsetX = v * 27;
      drawFrame(offsetX, 0, pal); // Frame 0: Upright
      drawFrame(offsetX + 9, 1, pal); // Frame 1: Sheared right
      drawFrame(offsetX + 18, -1, pal); // Frame 2: Sheared left
    });

    canvas.refresh();

    const tex = this.scene.textures.get(this.textureKey);
    for (let v = 0; v < 3; v++) {
      tex.add(`v${v}_0`, 0, v * 27, 0, 9, 8);
      tex.add(`v${v}_1`, 0, v * 27 + 9, 0, 9, 8);
      tex.add(`v${v}_2`, 0, v * 27 + 18, 0, 9, 8);
    }
  }

  private isGrassNeighborhood(
    jx: number,
    jy: number,
    materialKey: string
  ): boolean {
    // Only place tufts on grass pixels at least 3 px away from any non-grass class
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const col = this.scene.textures.getPixel(jx + dx, jy + dy, materialKey);
        if (!col) return false;
        if (!(col.green > 150 && col.red < 50 && col.blue < 50)) {
          return false;
        }
      }
    }
    return true;
  }

  public populate(
    worldX: number,
    worldY: number,
    materialKey = "dev-island-material"
  ): void {
    this.clear();

    const points: Array<{ x: number; y: number; variant: number }> = [];
    const minSpacing = 42; // Sparse placement

    // Sample across the walkable meadow area of the island
    for (let gy = 460; gy <= 740; gy += 36) {
      for (let gx = 100; gx <= 700; gx += 36) {
        const jx = gx + Math.floor((Math.random() - 0.5) * 16);
        const jy = gy + Math.floor((Math.random() - 0.5) * 16);

        if (this.scene.textures.exists(materialKey)) {
          if (!this.isGrassNeighborhood(jx, jy, materialKey)) {
            continue;
          }
        }

        const wx = worldX + jx;
        const wy = worldY + jy;

        const tooClose = points.some(
          (p) => Math.hypot(p.x - wx, p.y - wy) < minSpacing
        );
        if (!tooClose) {
          // Select variant based on local art brightness
          const artCol = this.scene.textures.exists("dev-island-home")
            ? this.scene.textures.getPixel(jx, jy, "dev-island-home")
            : null;
          let variant = 0;
          if (artCol) {
            if (artCol.green > 145)
              variant = 2; // Sunlit
            else if (artCol.green < 120) variant = 1; // Shady
          }
          points.push({ x: wx, y: wy, variant });
        }
      }
    }

    for (const p of points) {
      const sprite = this.scene.add.sprite(
        p.x,
        p.y,
        this.textureKey,
        `v${p.variant}_0`
      );
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(ENGINE_CONSTANTS.DEPTHS.GRASS + 1);

      this.tufts.push({
        sprite,
        baseX: p.x,
        baseY: p.y,
        phase: Math.random() * Math.PI * 2,
        variant: p.variant,
      });
    }
  }

  public update(
    time: number,
    playerX?: number,
    playerY?: number,
    reducedMotion = false
  ): void {
    if (!this.isVisible) return;

    if (reducedMotion) {
      for (const t of this.tufts) {
        t.sprite.setFrame(`v${t.variant}_0`);
      }
      return;
    }

    const tSec = time * 0.001;

    for (const tuft of this.tufts) {
      // Part grass away from player
      if (playerX !== undefined && playerY !== undefined) {
        const dist = Math.hypot(playerX - tuft.baseX, playerY - tuft.baseY);
        if (dist < 18) {
          tuft.sprite.setFrame(
            playerX > tuft.baseX ? `v${tuft.variant}_2` : `v${tuft.variant}_1`
          );
          continue;
        }
      }

      // Wind wave sway
      const wind = Math.sin(tSec * 2.2 + tuft.baseX * 0.012 + tuft.phase);
      if (wind > 0.45) {
        tuft.sprite.setFrame(`v${tuft.variant}_1`);
      } else if (wind < -0.45) {
        tuft.sprite.setFrame(`v${tuft.variant}_2`);
      } else {
        tuft.sprite.setFrame(`v${tuft.variant}_0`);
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    for (const t of this.tufts) {
      t.sprite.setVisible(visible);
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
