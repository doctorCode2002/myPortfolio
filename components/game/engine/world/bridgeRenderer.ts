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

  constructor(
    private scene: Phaser.Scene,
    bridges: BridgeSpec[]
  ) {
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

    // Tiled bridge strip (lossless 40px segment repeats along length + overlap)
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

    // Bridge depth: above island base/cliff layer (DEPTHS.GRASS = 10),
    // below object sprites whose baseY is greater than the deck point,
    // and below player sprite as player walks across.
    const deckDepth = Math.min(start.y, end.y);
    sprite.setDepth(deckDepth);

    this.sprites.push(sprite);
  }

  public destroy(): void {
    for (const sprite of this.sprites) {
      sprite.destroy();
    }
    this.sprites = [];
    this.corridors = [];
  }
}
