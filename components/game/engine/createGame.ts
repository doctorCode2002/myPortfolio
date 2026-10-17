import type Phaser from "phaser";
import { WorldScene } from "./scenes/WorldScene";

export function createGame(
  container: HTMLElement,
  PhaserLib: typeof Phaser
): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: PhaserLib.AUTO,
    parent: container,
    width: container.clientWidth || window.innerWidth,
    height: container.clientHeight || window.innerHeight,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#507ea8",
    scale: {
      mode: PhaserLib.Scale.RESIZE,
      autoCenter: PhaserLib.Scale.CENTER_BOTH,
    },
    scene: [WorldScene],
  };

  return new PhaserLib.Game(config);
}
