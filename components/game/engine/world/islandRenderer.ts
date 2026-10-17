import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

export type BiomeType = "grass" | "desert" | "snow" | "stone";

export interface IslandConfig {
  id?: string;
  centerX: number;
  centerY: number;
  surfaceRadiusX: number;
  surfaceRadiusY: number;
  walkRadiusX: number;
  walkRadiusY: number;
  shadowY?: number;
  biome?: BiomeType;
}

interface FloatingStone {
  graphics: Phaser.GameObjects.Graphics;
  baseY: number;
  offsetPhase: number;
}

export class Island {
  public readonly config: IslandConfig;
  private floatingStones: FloatingStone[] = [];

  constructor(scene: Phaser.Scene, config: IslandConfig) {
    this.config = {
      biome: "grass",
      shadowY: config.centerY + 250,
      ...config,
    };

    this.render(scene);
  }

  public isInsideWalkable(x: number, y: number): boolean {
    const dx = (x - this.config.centerX) / this.config.walkRadiusX;
    const dy = (y - this.config.centerY) / this.config.walkRadiusY;
    return dx * dx + dy * dy <= 1.0;
  }

  public update(time: number): void {
    for (const stone of this.floatingStones) {
      stone.graphics.y = Math.sin(time * 0.002 + stone.offsetPhase) * 3;
    }
  }

  private render(scene: Phaser.Scene): void {
    const { centerX, centerY, surfaceRadiusX, surfaceRadiusY } = this.config;
    const shadowY = this.config.shadowY ?? centerY + 250;
    const { DEPTHS } = ENGINE_CONSTANTS;

    // 1. Soft Shadow
    const shadow = scene.add.graphics();
    shadow.setDepth(DEPTHS.SHADOW);
    shadow.fillStyle(0x1a293d, 0.12);
    shadow.fillEllipse(
      centerX,
      shadowY,
      surfaceRadiusX * 2,
      surfaceRadiusY * 1.05
    );
    shadow.fillStyle(0x1a293d, 0.18);
    shadow.fillEllipse(
      centerX,
      shadowY,
      surfaceRadiusX * 1.25,
      surfaceRadiusY * 0.62
    );

    // 2. Rocky Underside tapering down to craggy roots
    const rock = scene.add.graphics();
    rock.setDepth(DEPTHS.ROCK);

    const rx = surfaceRadiusX;
    const ry = surfaceRadiusY;

    // Dark base silhouette
    rock.fillStyle(0x2f2520, 1);
    rock.beginPath();
    rock.moveTo(centerX - rx, centerY + 15);
    rock.lineTo(centerX - rx * 0.95, centerY + 45);
    rock.lineTo(centerX - rx * 0.8, centerY + 95);
    rock.lineTo(centerX - rx * 0.65, centerY + 140);
    rock.lineTo(centerX - rx * 0.5, centerY + 195);
    rock.lineTo(centerX - rx * 0.38, centerY + 235); // Left tip
    rock.lineTo(centerX - rx * 0.3, centerY + 205);
    rock.lineTo(centerX - rx * 0.18, centerY + 245);
    rock.lineTo(centerX - 5, centerY + 285); // Deepest center tip
    rock.lineTo(centerX + 15, centerY + 275);
    rock.lineTo(centerX + rx * 0.2, centerY + 225);
    rock.lineTo(centerX + rx * 0.36, centerY + 210); // Right tip
    rock.lineTo(centerX + rx * 0.43, centerY + 175);
    rock.lineTo(centerX + rx * 0.63, centerY + 130);
    rock.lineTo(centerX + rx * 0.84, centerY + 75);
    rock.lineTo(centerX + rx * 0.97, centerY + 35);
    rock.lineTo(centerX + rx, centerY + 15);
    rock.closePath();
    rock.fillPath();

    // Lit rock facets (top-left sunlight)
    rock.fillStyle(0x4d3f37, 1);
    rock.beginPath();
    rock.moveTo(centerX - rx * 0.97, centerY + 20);
    rock.lineTo(centerX - rx * 0.77, centerY + 100);
    rock.lineTo(centerX - rx * 0.45, centerY + 175);
    rock.lineTo(centerX - rx * 0.34, centerY + 215);
    rock.lineTo(centerX - rx * 0.16, centerY + 160);
    rock.lineTo(centerX - rx * 0.27, centerY + 80);
    rock.lineTo(centerX - rx * 0.54, centerY + 30);
    rock.closePath();
    rock.fillPath();

    // Highlight strata
    rock.fillStyle(0x6b5a4f, 1);
    rock.beginPath();
    rock.moveTo(centerX - rx * 0.81, centerY + 40);
    rock.lineTo(centerX - rx * 0.63, centerY + 110);
    rock.lineTo(centerX - rx * 0.41, centerY + 140);
    rock.lineTo(centerX - rx * 0.52, centerY + 70);
    rock.closePath();
    rock.fillPath();

    // Center ridge highlight
    rock.fillStyle(0x7a685c, 1);
    rock.beginPath();
    rock.moveTo(centerX - 50, centerY + 100);
    rock.lineTo(centerX - 15, centerY + 190);
    rock.lineTo(centerX - 5, centerY + 270);
    rock.lineTo(centerX - 25, centerY + 200);
    rock.lineTo(centerX - 45, centerY + 120);
    rock.closePath();
    rock.fillPath();

    // Deep shadow crevices on right
    rock.fillStyle(0x1e1714, 1);
    rock.beginPath();
    rock.moveTo(centerX + 20, centerY + 110);
    rock.lineTo(centerX + 50, centerY + 220);
    rock.lineTo(centerX + 15, centerY + 270);
    rock.lineTo(centerX + 30, centerY + 150);
    rock.closePath();
    rock.fillPath();

    // Detached floating satellite rocks
    const floatingConfigs = [
      { ox: -30, oy: 295, w: 14, h: 12, phase: 0 },
      { ox: 25, oy: 280, w: 10, h: 9, phase: 1.8 },
      { ox: -75, oy: 245, w: 12, h: 10, phase: 3.2 },
      { ox: 95, oy: 190, w: 16, h: 13, phase: 4.5 },
    ];
    for (const fr of floatingConfigs) {
      const stone = scene.add.graphics();
      stone.setDepth(DEPTHS.ROCK);
      stone.fillStyle(0x3a2f29, 1);
      stone.fillEllipse(centerX + fr.ox, centerY + fr.oy, fr.w, fr.h);
      stone.fillStyle(0x5a4b41, 1);
      stone.fillEllipse(
        centerX + fr.ox - 2,
        centerY + fr.oy - 2,
        fr.w * 0.6,
        fr.h * 0.6
      );
      this.floatingStones.push({
        graphics: stone,
        baseY: centerY + fr.oy,
        offsetPhase: fr.phase,
      });
    }

    // 3. Dirt Lip and hanging roots
    const dirt = scene.add.graphics();
    dirt.setDepth(DEPTHS.DIRT);
    dirt.fillStyle(0x52341d, 1);
    dirt.fillEllipse(centerX, centerY + 14, rx * 2 + 6, ry * 2 + 10);

    dirt.fillStyle(0x341e0d, 1);
    const rootOffsets = [-160, -110, -60, -10, 40, 90, 140, 180];
    for (const ro of rootOffsets) {
      if (Math.abs(ro) < rx - 10) {
        const rootY =
          centerY +
          Math.sqrt(Math.max(0, 1 - Math.pow(ro / (rx + 2), 2))) * ry +
          8;
        dirt.fillRect(centerX + ro, rootY, 3, 7 + ((Math.abs(ro) * 7) % 9));
      }
    }

    // 4. Lush Grass Top
    const grass = scene.add.graphics();
    grass.setDepth(DEPTHS.GRASS);

    grass.fillStyle(0x32612f, 1);
    grass.fillEllipse(centerX, centerY + 2, rx * 2, ry * 2);

    grass.fillStyle(0x448240, 1);
    grass.fillEllipse(centerX, centerY, rx * 2 - 4, ry * 2 - 4);

    grass.fillStyle(0x589d53, 1);
    grass.fillEllipse(centerX - 10, centerY - 8, rx * 1.6, ry * 1.5);

    // Overhanging grass fringe tufts
    grass.fillStyle(0x448240, 1);
    for (let angle = 0.15; angle < Math.PI - 0.15; angle += 0.08) {
      const gx = centerX + Math.cos(angle) * (rx - 4);
      const gy = centerY + Math.sin(angle) * (ry - 4);
      grass.fillTriangle(
        gx - 3,
        gy,
        gx + 3,
        gy,
        gx,
        gy + 5 + (Math.floor(gx * 3) % 4)
      );
    }

    // 5. Surface details: Stepping stones and wildflowers
    const details = scene.add.graphics();
    details.setDepth(DEPTHS.DETAILS);

    details.fillStyle(0x948573, 0.8);
    const stones = [
      { x: -20, y: -10, rx: 7, ry: 4 },
      { x: -5, y: 15, rx: 8, ry: 5 },
      { x: 18, y: -5, rx: 6, ry: 4 },
      { x: 35, y: 20, rx: 9, ry: 5 },
      { x: -45, y: 8, rx: 7, ry: 4 },
    ];
    for (const s of stones) {
      details.fillEllipse(centerX + s.x, centerY + s.y, s.rx * 2, s.ry * 2);
    }

    const flowers = [
      { x: -120, y: -20, col: 0xffd24d },
      { x: -115, y: -15, col: 0xffffff },
      { x: -90, y: 25, col: 0xe0703c },
      { x: -140, y: 10, col: 0xffd24d },
      { x: -60, y: -45, col: 0xffffff },
      { x: 70, y: -35, col: 0xffd24d },
      { x: 110, y: -15, col: 0xe0703c },
      { x: 135, y: 12, col: 0xffffff },
      { x: 85, y: 30, col: 0xffd24d },
      { x: 150, y: -10, col: 0xe0703c },
      { x: 30, y: -50, col: 0xffffff },
      { x: -30, y: 45, col: 0xffd24d },
    ];
    for (const f of flowers) {
      details.fillStyle(f.col, 1);
      details.fillRect(centerX + f.x, centerY + f.y, 3, 3);
      details.fillStyle(0x2f522b, 1);
      details.fillRect(centerX + f.x + 1, centerY + f.y + 3, 2, 2);
    }
  }
}
