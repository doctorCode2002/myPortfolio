import type Phaser from "phaser";
import { WorldScene } from "./scenes/WorldScene";

export function createGame(
  container: HTMLElement,
  PhaserLib: typeof Phaser,
  initialCharSheet = "char_0"
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

  const game = new PhaserLib.Game(config);
  game.scene.start("WorldScene", { charSheet: initialCharSheet });
  return game;
}
