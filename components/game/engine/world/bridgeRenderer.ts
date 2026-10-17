import Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";
import {
  createBridgeCorridor,
  isPointInCorridor,
  type BridgeCorridor,
  type Point2D,
} from "./bridgeGeometry";

export interface BridgeSpec {
  from: string;
  to: string;
  style: "rope" | "stone";
  start: Point2D;
  end: Point2D;
}

export class BridgeRenderer {
  private corridors: BridgeCorridor[] = [];
  private sprites: Phaser.GameObjects.TileSprite[] = [];
  private shadowGraphics: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    bridges: BridgeSpec[]
  ) {
    const { DEPTHS } = ENGINE_CONSTANTS;

    // Atmospheric shadow below floating bridges
    this.shadowGraphics = scene.add.graphics();
    this.shadowGraphics.setDepth(DEPTHS.SHADOW);

    for (const spec of bridges) {
      const corridor = createBridgeCorridor({
        fromIslandId: spec.from,
        toIslandId: spec.to,
        style: spec.style,
        start: spec.start,
        end: spec.end,
        width: ENGINE_CONSTANTS.BRIDGE.CORRIDOR_WIDTH,
        overlap: ENGINE_CONSTANTS.BRIDGE.OVERLAP,
      });

      this.corridors.push(corridor);
      this.renderBridge(corridor);
    }
  }

  public getCorridors(): readonly BridgeCorridor[] {
    return this.corridors;
  }

  /**
   * Checks if world coordinates (x, y) fall within any walkable bridge corridor.
   */
  public isWalkable(x: number, y: number): boolean {
    for (let i = 0; i < this.corridors.length; i++) {
      if (isPointInCorridor(this.corridors[i]!, x, y)) {
        return true;
      }
    }
    return false;
  }

  private renderBridge(corridor: BridgeCorridor): void {
    const { start, end, length, angle, style } = corridor;
    if (length <= 0) return;

    // 1. Soft atmospheric shadow beneath the bridge
    this.shadowGraphics.lineStyle(14, 0x0c1322, 0.18);
    this.shadowGraphics.lineBetween(start.x, start.y + 24, end.x, end.y + 24);

    // 2. Tiled bridge strip (lossless 40px segment repeats along length + overlap)
    const textureKey = style === "stone" ? "bridge-stone" : "bridge-rope";
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const totalLength = length + corridor.overlap * 2;

    const sprite = this.scene.add.tileSprite(
      mx,
      my,
      totalLength,
      40,
      textureKey
    );
    sprite.setOrigin(0.5, 0.5);
    sprite.setRotation(angle);

    // Bridge depth: below player sprite (player.y + 12 ~ 2000+), above ground (DEPTHS.GRASS = 10)
    // The player's depth will sort above the deck as they walk across.
    sprite.setDepth(ENGINE_CONSTANTS.DEPTHS.DETAILS - 2);

    this.sprites.push(sprite);
  }

  public destroy(): void {
    this.shadowGraphics.destroy();
    for (const sprite of this.sprites) {
      sprite.destroy();
    }
    this.sprites = [];
    this.corridors = [];
  }
}
