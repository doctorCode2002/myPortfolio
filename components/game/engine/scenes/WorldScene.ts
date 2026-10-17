import Phaser from "phaser";
import { ENGINE_CONSTANTS, computeIntegerZoom } from "../constants";
import { Building } from "../entities/Building";
import { Npc } from "../entities/Npc";
import { Player } from "../entities/Player";
import { gameEvents } from "../events";
import { ControlsManager } from "../input/controls";
import { Island } from "../world/islandRenderer";
import { SkySystem } from "../world/sky";

export class WorldScene extends Phaser.Scene {
  private sky!: SkySystem;
  private centerIsland!: Island;
  private player!: Player;
  private controls!: ControlsManager;
  private demoNpc!: Npc;
  private demoBuilding!: Building;

  private unbindEvents: Array<() => void> = [];
  private initialCharSheet = "char_0";

  constructor() {
    super({ key: "WorldScene" });
  }

  init(data: { charSheet?: string }): void {
    if (data?.charSheet) {
      this.initialCharSheet = data.charSheet;
    }
  }

  preload(): void {
    // Preload all 6 character sheets so avatar switching is instantaneous
    for (let i = 0; i <= 5; i++) {
      const key = `char_${i}`;
      this.load.spritesheet(key, `/game/characters/${key}.png`, {
        frameWidth: ENGINE_CONSTANTS.PLAYER.FRAME_WIDTH,
        frameHeight: ENGINE_CONSTANTS.PLAYER.FRAME_HEIGHT,
      });
    }
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

    // 3. Demo Building (Projects Pavilion) on upper-left meadow
    this.demoBuilding = new Building(this, {
      id: "pavilion",
      titleKey: "demoBuildingTitle",
      messageKey: "demoBuildingDialogue",
      x: 700,
      y: 490,
      width: 76,
      height: 68,
    });

    // 4. Demo NPC (Island Mayor) on right side of meadow
    this.demoNpc = new Npc(this, {
      id: "mayor",
      nameKey: "demoNpcName",
      roleKey: "demoNpcRole",
      charSheet: "char_1",
      x: 890,
      y: 540,
      interactionRadius: 48,
      dialogueKey: "demoNpcDialogue",
    });

    // 5. Player Character Entity
    this.player = new Player(
      this,
      PLAYER.START_X,
      PLAYER.START_Y,
      this.initialCharSheet
    );

    // 6. Input Controls (Keyboard, Touch Joystick, Tap-to-move)
    this.controls = new ControlsManager(this);

    // 7. Subscribe to Event Bus for React interactions
    this.setupEventSubscriptions();

    // 8. Camera with smooth lerp and integer zoom
    this.setupCamera(WORLD_WIDTH, WORLD_HEIGHT);
  }

  override update(time: number, delta: number): void {
    const dt = delta / 1000;

    // Parallax clouds & floating rock bobbing
    this.sky.update(delta);
    this.centerIsland.update(time);

    // Update NPC and Building interaction states
    const isNpcInRange = this.demoNpc.update(
      this.player.x,
      this.player.y,
      time
    );
    const isBuildingInRange = this.demoBuilding.update(
      this.player.x,
      this.player.y,
      time
    );

    // Handle interact trigger (E or Space key, or tap)
    if (this.controls.isInteractTriggered()) {
      if (isNpcInRange) {
        this.demoNpc.interact();
      } else if (isBuildingInRange) {
        this.demoBuilding.interact();
      }
    }

    // Gather continuous normalized input
    const { normX, normY } = this.controls.getMovementVector(
      this.player.x,
      this.player.y,
      (x, y) => this.centerIsland.isInsideWalkable(x, y)
    );

    // Move player with island bounds and solid building wall collision
    this.player.move(
      normX,
      normY,
      dt,
      (x, y) => this.centerIsland.isInsideWalkable(x, y),
      (x, y) => this.demoBuilding.isColliding(x, y)
    );
  }

  private setupEventSubscriptions(): void {
    // Listen for avatar switch from React CharacterPicker
    this.unbindEvents.push(
      gameEvents.on("player:change-character", ({ charSheet }) => {
        this.player.setCharacterSheet(this, charSheet);
      })
    );

    // Listen for game freeze (when React dialogue/picker is open)
    this.unbindEvents.push(
      gameEvents.on("game:freeze", (frozen) => {
        this.player.setFrozen(frozen);
        this.controls.setFrozen(frozen);
      })
    );

    // Clean up on scene destroy
    this.events.once("shutdown", () => {
      for (const unbind of this.unbindEvents) {
        unbind();
      }
      this.unbindEvents = [];
    });
  }

  private setupCamera(worldWidth: number, worldHeight: number): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldWidth, worldHeight);

    // Smooth camera lerp (0.06, 0.06) with pixel-rounded coordinates
    cam.startFollow(this.player.sprite, true, 0.06, 0.06);

    const initialZoom = computeIntegerZoom(this.scale.width, this.scale.height);
    cam.setZoom(initialZoom);

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
