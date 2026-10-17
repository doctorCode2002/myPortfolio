import Phaser from "phaser";
import { ENGINE_CONSTANTS, findClosestZoomIndex } from "../constants";
import type { Building } from "../entities/Building";
import { Npc } from "../entities/Npc";
import { Player } from "../entities/Player";
import { gameEvents } from "../events";
import { ControlsManager } from "../input/controls";
import { setupCameraAndZoom } from "../world/cameraZoom";
import { IllustratedIsland, type IslandArt } from "../world/illustratedIsland";
import type { Island } from "../world/islandRenderer";
import { createProceduralFallback } from "../world/proceduralFallback";
import { LivingWorldFX } from "../fx/livingWorldFX";

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

  private zoomControl!: {
    setZoomIndex: (idx: number) => number;
    getTargetZoom: () => number;
  };
  private curZoomIndex = 2;

  constructor() {
    super({ key: "WorldScene" });
  }

  init(data: { charSheet?: string }): void {
    if (data?.charSheet) this.initialCharSheet = data.charSheet;
  }

  preload(): void {
    for (let i = 0; i <= 5; i++) {
      this.load.spritesheet(`char_${i}`, `/game/characters/char_${i}.png`, {
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
      const ix = Math.round((WORLD_WIDTH - art.size.w) / 2),
        iy = 120;
      this.illustratedIsland = new IllustratedIsland(
        this,
        "dev-island-home",
        "dev-island-material",
        art,
        ix,
        iy
      );
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
      this.fx.create({ islandArt: art, worldX: ix, worldY: iy });
    } else {
      const fb = createProceduralFallback(this, this.initialCharSheet);
      this.centerIsland = fb.centerIsland;
      this.demoBuilding = fb.demoBuilding;
      this.demoNpc = fb.demoNpc;
      this.player = fb.player;
      this.fx.create();
    }

    this.controls = new ControlsManager(this);
    this.setupEventSubscriptions();
    gameEvents.resetUiLocks();

    this.zoomControl = setupCameraAndZoom(
      this,
      this.player.sprite,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      (zoom) => gameEvents.emit("camera:zoom-changed", { zoom })
    );

    if (
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("edit") === "1" &&
      this.illustratedIsland
    ) {
      import("../../editor/editorPhaser").then(({ initDevEditor }) => {
        const cleanup = initDevEditor(this, this.illustratedIsland!);
        this.events.once("shutdown", cleanup);
      });
    }

    this.scale.on("resize", () => this.fx.resize());
  }

  override update(time: number, delta: number): void {
    const dt = delta / 1000;
    this.fx.update(time, delta, this.player?.x, this.player?.y);

    const cam = this.cameras.main;
    const targetZoom = this.zoomControl.getTargetZoom();
    if (Math.abs(cam.zoom - targetZoom) > 0.005) {
      cam.zoom = Phaser.Math.Linear(cam.zoom, targetZoom, 0.15);
    } else {
      cam.zoom = targetZoom;
    }

    const isNpcInRange = this.demoNpc.update(
      this.player.x,
      this.player.y,
      time
    );
    const isBuildingInRange = this.illustratedIsland
      ? Boolean(this.illustratedIsland.activeDoor)
      : Boolean(this.demoBuilding?.update(this.player.x, this.player.y, time));

    if (this.illustratedIsland)
      this.illustratedIsland.update(this.player.x, this.player.y, time);
    else this.centerIsland?.update(time);

    if (this.controls.isInteractTriggered()) {
      if (isNpcInRange) this.demoNpc.interact();
      else if (isBuildingInRange)
        (this.illustratedIsland ?? this.demoBuilding)?.interact();
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
    this.curZoomIndex = this.zoomControl.setZoomIndex(idx);
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
        this.setZoomLevel(this.curZoomIndex + 1)
      ),
      gameEvents.on("camera:zoom-out", () =>
        this.setZoomLevel(this.curZoomIndex - 1)
      ),
      gameEvents.on("camera:set-zoom", ({ zoom }) =>
        this.setZoomLevel(findClosestZoomIndex(zoom))
      )
    );
    this.events.once("shutdown", () => {
      for (const unbind of this.unbindEvents) unbind();
      this.unbindEvents = [];
      this.illustratedIsland?.destroy();
      this.fx.destroy();
    });
  }
}
