import Phaser from "phaser";
import { ENGINE_CONSTANTS, computeIntegerZoom } from "../constants";
import { Building } from "../entities/Building";
import { Npc } from "../entities/Npc";
import { Player } from "../entities/Player";
import { gameEvents } from "../events";
import { ControlsManager } from "../input/controls";
import { IllustratedIsland, type IslandArt } from "../world/illustratedIsland";
import { Island } from "../world/islandRenderer";
import { LivingWorldFX } from "../fx/livingWorldFX";

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

export class WorldScene extends Phaser.Scene {
  private fx!: LivingWorldFX;
  private illustratedIsland: IllustratedIsland | null = null;
  private centerIsland: Island | null = null;
  private player!: Player;
  private controls!: ControlsManager;
  private demoNpc!: Npc;
  private demoBuilding: Building | null = null;

  private unbindEvents: Array<() => void> = [];
  private initialCharSheet = "char_0";

  private zoomIndex = 2;
  private targetZoom = 2;
  private pinchDist = 0;

  constructor() {
    super({ key: "WorldScene" });
  }

  init(data: { charSheet?: string }): void {
    if (data?.charSheet) this.initialCharSheet = data.charSheet;
  }

  preload(): void {
    for (let i = 0; i <= 5; i++) {
      const key = `char_${i}`;
      this.load.spritesheet(key, `/game/characters/${key}.png`, {
        frameWidth: ENGINE_CONSTANTS.PLAYER.FRAME_WIDTH,
        frameHeight: ENGINE_CONSTANTS.PLAYER.FRAME_HEIGHT,
      });
    }
    this.load.json("dev-island-json", "/game/islands/_dev/island.json");
    this.load.image("dev-island-home", "/game/islands/_dev/home.webp");
    LivingWorldFX.preload(this);
  }

  create(): void {
    const { WORLD_WIDTH, WORLD_HEIGHT } = ENGINE_CONSTANTS;
    this.fx = new LivingWorldFX(this);

    const art = this.cache.json.get("dev-island-json") as IslandArt | null;
    if (art && this.textures.exists("dev-island-home") && art.size) {
      const ix = Math.round((WORLD_WIDTH - art.size.w) / 2);
      const iy = 120;
      this.illustratedIsland = new IllustratedIsland(
        this,
        "dev-island-home",
        art,
        ix,
        iy
      );
      this.fx.create({ islandArt: art, worldX: ix, worldY: iy });
      const px = ix + (art.spawns.player?.[0] ?? art.size.w / 2);
      const py = iy + (art.spawns.player?.[1] ?? art.size.h / 2);
      this.player = new Player(this, px, py, this.initialCharSheet);

      const mx = ix + (art.spawns.mayor?.[0] ?? art.size.w / 2 + 35);
      const my = iy + (art.spawns.mayor?.[1] ?? art.size.h / 2);
      this.demoNpc = new Npc(this, {
        id: "mayor",
        nameKey: "demoNpcName",
        roleKey: "demoNpcRole",
        charSheet: "char_1",
        x: mx,
        y: my,
        dialogueKey: "demoNpcDialogue",
      });
    } else {
      this.initProceduralFallback();
    }

    this.controls = new ControlsManager(this);
    this.setupEventSubscriptions();
    gameEvents.resetUiLocks();

    this.setupCamera(WORLD_WIDTH, WORLD_HEIGHT);
    this.setupZoomInputs();
  }

  private initProceduralFallback(): void {
    const { ISLAND, PLAYER } = ENGINE_CONSTANTS;
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
    this.demoBuilding = new Building(this, {
      id: "pavilion",
      titleKey: "demoBuildingTitle",
      messageKey: "demoBuildingDialogue",
      x: 700,
      y: 490,
    });
    this.demoNpc = new Npc(this, {
      id: "mayor",
      nameKey: "demoNpcName",
      roleKey: "demoNpcRole",
      charSheet: "char_1",
      x: 890,
      y: 540,
      dialogueKey: "demoNpcDialogue",
    });
    this.player = new Player(
      this,
      PLAYER.START_X,
      PLAYER.START_Y,
      this.initialCharSheet
    );
    this.fx.create();
  }

  override update(time: number, delta: number): void {
    const dt = delta / 1000;
    this.fx.update(time, delta, this.player?.x, this.player?.y);

    const cam = this.cameras.main;
    if (Math.abs(cam.zoom - this.targetZoom) > 0.005) {
      cam.zoom = Phaser.Math.Linear(cam.zoom, this.targetZoom, 0.15);
    } else {
      cam.zoom = this.targetZoom;
    }

    const isNpcInRange = this.demoNpc.update(
      this.player.x,
      this.player.y,
      time
    );
    const isBuildingInRange = this.illustratedIsland
      ? Boolean(this.illustratedIsland.activeDoor)
      : Boolean(this.demoBuilding?.update(this.player.x, this.player.y, time));

    if (this.illustratedIsland) {
      this.illustratedIsland.update(this.player.x, this.player.y, time);
    } else {
      this.centerIsland?.update(time);
    }

    if (this.controls.isInteractTriggered()) {
      if (isNpcInRange) this.demoNpc.interact();
      else if (isBuildingInRange) {
        if (this.illustratedIsland) this.illustratedIsland.interact();
        else this.demoBuilding?.interact();
      }
    }

    const isWalkable = (x: number, y: number): boolean =>
      this.illustratedIsland
        ? this.illustratedIsland.isInsideWalkable(x, y)
        : (this.centerIsland?.isInsideWalkable(x, y) ?? true);

    const isObstacle = (x: number, y: number): boolean =>
      !this.illustratedIsland && Boolean(this.demoBuilding?.isColliding(x, y));

    const { normX, normY } = this.controls.getMovementVector(
      this.player.x,
      this.player.y,
      isWalkable
    );
    this.player.move(normX, normY, dt, isWalkable, isObstacle);
  }

  private setZoomLevel(idx: number): void {
    this.zoomIndex = Phaser.Math.Clamp(idx, 0, ZOOM_LEVELS.length - 1);
    this.targetZoom = ZOOM_LEVELS[this.zoomIndex] ?? 2;
    gameEvents.emit("camera:zoom-changed", { zoom: this.targetZoom });
  }

  private setupZoomInputs(): void {
    this.input.addPointer(1);
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        this.setZoomLevel(dy < 0 ? this.zoomIndex + 1 : this.zoomIndex - 1);
      }
    );
    this.input.on("pointermove", () => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1?.isDown && p2?.isDown) {
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (this.pinchDist > 0 && Math.abs(dist - this.pinchDist) > 25) {
          this.setZoomLevel(
            dist > this.pinchDist ? this.zoomIndex + 1 : this.zoomIndex - 1
          );
          this.pinchDist = dist;
        } else if (!this.pinchDist) {
          this.pinchDist = dist;
        }
      } else {
        this.pinchDist = 0;
      }
    });
  }

  private setupEventSubscriptions(): void {
    this.unbindEvents.push(
      gameEvents.on("player:change-character", ({ charSheet }) => {
        this.player.setCharacterSheet(this, charSheet);
      }),
      gameEvents.on("game:freeze", (frozen) => {
        this.player.setFrozen(frozen);
        this.controls.setFrozen(frozen);
      }),
      gameEvents.on("ui:close", () => {
        this.player.setFrozen(false);
        this.controls.setFrozen(false);
      }),
      gameEvents.on("camera:zoom-in", () =>
        this.setZoomLevel(this.zoomIndex + 1)
      ),
      gameEvents.on("camera:zoom-out", () =>
        this.setZoomLevel(this.zoomIndex - 1)
      ),
      gameEvents.on("camera:set-zoom", ({ zoom }) => {
        let bestIdx = 4;
        let bestDiff = Infinity;
        for (let i = 0; i < ZOOM_LEVELS.length; i++) {
          const diff = Math.abs((ZOOM_LEVELS[i] ?? 2) - zoom);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
          }
        }
        this.setZoomLevel(bestIdx);
      })
    );
    this.events.once("shutdown", () => {
      this.fx.destroy();
      for (const unbind of this.unbindEvents) unbind();
      this.unbindEvents = [];
    });
  }

  private computeFitZoom(viewW: number, viewH: number): number {
    const rawFit = Math.min(viewW / 880, viewH / 1200);
    let bestIdx = 0;
    for (let i = 0; i < ZOOM_LEVELS.length; i++) {
      if ((ZOOM_LEVELS[i] ?? 0.5) <= Math.max(0.5, rawFit)) {
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private setupCamera(worldWidth: number, worldHeight: number): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor("#507ea8");
    cam.setBounds(0, 0, worldWidth, worldHeight);
    cam.startFollow(this.player.sprite, true, 0.06, 0.06);

    const isPhone = this.scale.width < 640;
    if (isPhone) {
      this.zoomIndex = this.computeFitZoom(this.scale.width, this.scale.height);
    } else {
      const initialZoom = computeIntegerZoom(
        this.scale.width,
        this.scale.height
      );
      const closestIdx = ZOOM_LEVELS.findIndex((z) => z === initialZoom);
      this.zoomIndex = closestIdx >= 0 ? closestIdx : 4;
    }
    this.targetZoom = ZOOM_LEVELS[this.zoomIndex] ?? 2;
    cam.setZoom(this.targetZoom);

    this.scale.on("resize", () => {
      this.fx.resize();
    });
  }
}
