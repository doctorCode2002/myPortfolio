import Phaser from "phaser";
import { ENGINE_CONSTANTS, computeIntegerZoom } from "../constants";
import { Player } from "../entities/Player";
import { ControlsManager } from "../input/controls";
import { Island } from "../world/islandRenderer";
import { SkySystem } from "../world/sky";

export class WorldScene extends Phaser.Scene {
  private sky!: SkySystem;
  private centerIsland!: Island;
  private player!: Player;
  private controls!: ControlsManager;

  constructor() {
    super({ key: "WorldScene" });
  }

  preload(): void {
    this.load.spritesheet("player", "/game/characters/char_0.png", {
      frameWidth: ENGINE_CONSTANTS.PLAYER.FRAME_WIDTH,
      frameHeight: ENGINE_CONSTANTS.PLAYER.FRAME_HEIGHT,
    });
  }

  create(): void {
    const { ISLAND, PLAYER, WORLD_WIDTH, WORLD_HEIGHT } = ENGINE_CONSTANTS;

    // 1. Procedural Sky & Parallax Drifting Clouds
    this.sky = new SkySystem(this);

    // 2. Procedural Floating Island (Center Island)
    this.centerIsland = new Island(this, {
      id: "center-island",
      centerX: ISLAND.CENTER_X,
      centerY: ISLAND.CENTER_Y,
      surfaceRadiusX: ISLAND.SURFACE_RADIUS_X,
      surfaceRadiusY: ISLAND.SURFACE_RADIUS_Y,
      walkRadiusX: ISLAND.WALK_RADIUS_X,
      walkRadiusY: ISLAND.WALK_RADIUS_Y,
      shadowY: ISLAND.SHADOW_Y,
      biome: "grass",
    });

    // 3. Player Character Entity
    this.player = new Player(this, PLAYER.START_X, PLAYER.START_Y);

    // 4. Input Controls (Keyboard, Touch Joystick, Tap-to-move)
    this.controls = new ControlsManager(this);

    // 5. Camera with smooth lerp and integer zoom framing the floating island
    this.setupCamera(WORLD_WIDTH, WORLD_HEIGHT);
  }

  override update(time: number, delta: number): void {
    const dt = delta / 1000;

    // Parallax cloud drifting and island rock floating animation
    this.sky.update(delta);
    this.centerIsland.update(time);

    // Gather continuous normalized input
    const { normX, normY } = this.controls.getMovementVector(
      this.player.x,
      this.player.y,
      (x, y) => this.centerIsland.isInsideWalkable(x, y)
    );

    // Move player with wall-sliding island boundary collision
    this.player.move(normX, normY, dt, (x, y) =>
      this.centerIsland.isInsideWalkable(x, y)
    );
  }

  private setupCamera(worldWidth: number, worldHeight: number): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldWidth, worldHeight);

    // Smooth camera lerp (0.06, 0.06) with pixel-rounded coordinates
    cam.startFollow(this.player.sprite, true, 0.06, 0.06);

    const initialZoom = computeIntegerZoom(this.scale.width, this.scale.height);
    cam.setZoom(initialZoom);

    // Handle viewport resize events
    this.scale.on(
      "resize",
      (gameSize: Phaser.Structs.Size) => {
        const w = gameSize.width;
        const h = gameSize.height;

        this.sky.resize(w, h);

        const nextZoom = computeIntegerZoom(w, h);
        this.cameras.main.setZoom(nextZoom);
      },
      this
    );
  }
}
