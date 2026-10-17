import type Phaser from "phaser";
import { WorldScene } from "./scenes/WorldScene";

export function createGame(
  container: HTMLElement,
  PhaserLib: typeof Phaser,
  initialCharSheet = "char_0",
  dict?: unknown,
  locale = "en"
): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: PhaserLib.AUTO,
    parent: container,
    width: container.clientWidth || window.innerWidth,
    height: container.clientHeight || window.innerHeight,
    pixelArt: true,
    roundPixels: true,
    transparent: true,
    backgroundColor: "#929391",
    scale: {
      mode: PhaserLib.Scale.RESIZE,
      autoCenter: PhaserLib.Scale.CENTER_BOTH,
    },
    audio: {
      noAudio: true,
    },
    scene: [WorldScene],
  };

  const game = new PhaserLib.Game(config);
  game.scene.start("WorldScene", {
    charSheet: initialCharSheet,
    dict,
    locale,
  });
  return game;
}
