import Phaser from "phaser";
import { BRIDGES, ISLANDS } from "@/lib/content/world";
import { ENGINE_CONSTANTS, findClosestZoomIndex } from "../constants";
import type { Building } from "../entities/Building";
import { Npc } from "../entities/Npc";
import { Player } from "../entities/Player";
import { gameEvents } from "../events";
import { LivingWorldFX } from "../fx/livingWorldFX";
import { ControlsManager } from "../input/controls";
import {
  computeWorldLayout,
  resolveIslandAnchor,
  type WorldLayoutResult,
} from "../world/bridgeGeometry";
import { BridgeRenderer, type BridgeSpec } from "../world/bridgeRenderer";
import { setupCameraAndZoom } from "../world/cameraZoom";
import { IllustratedIsland, type IslandArt } from "../world/illustratedIsland";
import type { Island } from "../world/islandRenderer";
import { createProceduralFallback } from "../world/proceduralFallback";

export class WorldScene extends Phaser.Scene {
  private fx!: LivingWorldFX;
  private illustratedIslands = new Map<string, IllustratedIsland>();
  private bridgeRenderer: BridgeRenderer | null = null;
  private npcs: Npc[] = [];
  private player!: Player;
  private controls!: ControlsManager;

  // Fallback mode entities
  private centerIsland: Island | null = null;
  private demoBuilding: Building | null = null;

  private unbindEvents: Array<() => void> = [];
  private initialCharSheet = "char_0";
  private dict?: unknown;
  private locale = "en";

  private zoomControl!: {
    setZoomIndex: (idx: number) => number;
    getTargetZoom: () => number;
  };
  private curZoomIndex = 2;

  constructor() {
    super({ key: "WorldScene" });
  }

  init(data: { charSheet?: string; dict?: unknown; locale?: string }): void {
    if (data?.charSheet) this.initialCharSheet = data.charSheet;
    if (data?.dict) this.dict = data.dict;
    if (data?.locale) this.locale = data.locale;
  }

  preload(): void {
    for (let i = 0; i <= 5; i++) {
      this.load.spritesheet(`char_${i}`, `/game/characters/char_${i}.png`, {
        frameWidth: ENGINE_CONSTANTS.PLAYER.FRAME_WIDTH,
        frameHeight: ENGINE_CONSTANTS.PLAYER.FRAME_HEIGHT,
      });
    }

    // Preload all real islands
    for (const island of ISLANDS) {
      this.load.json(
        `island-json-${island.id}`,
        `/game/islands/${island.id}/island.json`
      );
      this.load.image(
        `island-art-${island.id}`,
        `/game/islands/${island.id}/island.webp`
      );
      this.load.image(
        `island-material-${island.id}`,
        `/game/islands/${island.id}/material.png`
      );
    }

    // Preload bridges
    this.load.image("bridge-rope", "/game/bridges/rope.webp");
    this.load.image("bridge-stone", "/game/bridges/stone.webp");

    LivingWorldFX.preload(this);
  }

  create(): void {
    const artMap = new Map<string, IslandArt>();
    let allArtAvailable = true;

    for (const island of ISLANDS) {
      const art = this.cache.json.get(
        `island-json-${island.id}`
      ) as IslandArt | null;
      const hasTex = this.textures.exists(`island-art-${island.id}`);
      if (!art || !hasTex || !art.size) {
        allArtAvailable = false;
        break;
      }
      artMap.set(island.id, art);
    }

    let worldWidth: number = ENGINE_CONSTANTS.WORLD_WIDTH;
    let worldHeight: number = ENGINE_CONSTANTS.WORLD_HEIGHT;

    this.fx = new LivingWorldFX(this);

    if (allArtAvailable) {
      const islandSizes: Record<string, { w: number; h: number }> = {};
      for (const [id, art] of artMap.entries()) {
        islandSizes[id] = art.size;
      }

      const layout: WorldLayoutResult = computeWorldLayout(
        ISLANDS,
        islandSizes,
        ENGINE_CONSTANTS.LAYOUT_SCALE,
        600
      );

      worldWidth = layout.bounds.width;
      worldHeight = layout.bounds.height;

      // 1. Create IllustratedIsland instances
      for (const island of ISLANDS) {
        const islandLayout = layout.islands.get(island.id)!;
        const art = artMap.get(island.id)!;
        const ill = new IllustratedIsland(
          this,
          `island-art-${island.id}`,
          `island-material-${island.id}`,
          art,
          islandLayout.worldX,
          islandLayout.worldY,
          this.dict as Record<string, unknown> | undefined,
          this.locale
        );
        this.illustratedIslands.set(island.id, ill);
      }

      // 2. Create Bridges between island anchors
      const bridgeSpecs: BridgeSpec[] = [];
      for (const bridge of BRIDGES) {
        const fromIsland = this.illustratedIslands.get(bridge.from);
        const toIsland = this.illustratedIslands.get(bridge.to);
        const fromLayout = layout.islands.get(bridge.from);
        const toLayout = layout.islands.get(bridge.to);

        if (!fromIsland || !toIsland || !fromLayout || !toLayout) continue;

        const fromAnchor = resolveIslandAnchor(
          bridge.to,
          fromIsland.art,
          { x: fromLayout.centerX, y: fromLayout.centerY },
          { x: toLayout.centerX, y: toLayout.centerY },
          fromIsland.materialCanvas
            .getContext("2d", { willReadFrequently: true })
            ?.getImageData(0, 0, fromIsland.art.size.w, fromIsland.art.size.h)
            .data
        );

        const toAnchor = resolveIslandAnchor(
          bridge.from,
          toIsland.art,
          { x: toLayout.centerX, y: toLayout.centerY },
          { x: fromLayout.centerX, y: fromLayout.centerY },
          toIsland.materialCanvas
            .getContext("2d", { willReadFrequently: true })
            ?.getImageData(0, 0, toIsland.art.size.w, toIsland.art.size.h).data
        );

        bridgeSpecs.push({
          from: bridge.from,
          to: bridge.to,
          style: bridge.style ?? "rope",
          start: {
            x: fromLayout.worldX + fromAnchor.x,
            y: fromLayout.worldY + fromAnchor.y,
          },
          end: {
            x: toLayout.worldX + toAnchor.x,
            y: toLayout.worldY + toAnchor.y,
          },
        });
      }

      this.bridgeRenderer = new BridgeRenderer(this, bridgeSpecs);

      // 3. Spawn player at home island's spawns.player
      const homeLayout = layout.islands.get("home")!;
      const homeArt = artMap.get("home")!;
      const px =
        homeLayout.worldX + (homeArt.spawns.player?.[0] ?? homeArt.size.w / 2);
      const py =
        homeLayout.worldY + (homeArt.spawns.player?.[1] ?? homeArt.size.h / 2);
      this.player = new Player(this, px, py, this.initialCharSheet);

      // 4. Place one Npc per island that has a mayor
      this.npcs = [];
      for (let i = 0; i < ISLANDS.length; i++) {
        const island = ISLANDS[i]!;
        if (!island.mayor) continue;
        const islandLayout = layout.islands.get(island.id)!;
        const art = artMap.get(island.id)!;
        const mx =
          islandLayout.worldX + (art.spawns.mayor?.[0] ?? art.size.w / 2);
        const my =
          islandLayout.worldY + (art.spawns.mayor?.[1] ?? art.size.h / 2);

        const npc = new Npc(this, {
          id: island.mayor.id,
          charSheet: `char_${(i % 5) + 1}`,
          x: mx,
          y: my,
          locale: this.locale,
        });
        this.npcs.push(npc);
      }

      // 5. LivingWorldFX
      const fxIslands = ISLANDS.map((isl) => {
        const islLayout = layout.islands.get(isl.id)!;
        const art = artMap.get(isl.id)!;
        return {
          id: isl.id,
          worldX: islLayout.worldX,
          worldY: islLayout.worldY,
          width: art.size.w,
          height: art.size.h,
          islandImageKey: `island-art-${isl.id}`,
          materialTextureKey: `island-material-${isl.id}`,
        };
      });

      this.fx.create({
        islands: fxIslands,
        worldBounds: layout.bounds,
      });
    } else {
      const fb = createProceduralFallback(this, this.initialCharSheet);
      this.centerIsland = fb.centerIsland;
      this.demoBuilding = fb.demoBuilding;
      this.npcs = [fb.demoNpc];
      this.player = fb.player;
      this.fx.create();
    }

    this.controls = new ControlsManager(this);
    this.setupEventSubscriptions();
    gameEvents.resetUiLocks();

    this.zoomControl = setupCameraAndZoom(
      this,
      this.player.sprite,
      worldWidth,
      worldHeight,
      (zoom) => gameEvents.emit("camera:zoom-changed", { zoom })
    );

    if (
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("edit") === "1" &&
      this.illustratedIslands.size > 0
    ) {
      import("../../editor/editorPhaser").then(({ initDevEditor }) => {
        const cleanup = initDevEditor(this, this.illustratedIslands, "home");
        this.events.once("shutdown", cleanup);
      });
    }

    this.scale.on("resize", () => this.fx.resize());
  }

  override update(time: number, delta: number): void {
    const dt = delta / 1000;
    const cam = this.cameras.main;

    const cullRect = {
      x: cam.worldView.x - 100,
      y: cam.worldView.y - 100,
      width: cam.worldView.width + 200,
      height: cam.worldView.height + 200,
    };
    this.fx.update(time, delta, this.player?.x, this.player?.y, cullRect);

    const targetZoom = this.zoomControl.getTargetZoom();
    if (Math.abs(cam.zoom - targetZoom) > 0.005) {
      cam.zoom = Phaser.Math.Linear(cam.zoom, targetZoom, 0.15);
    } else {
      cam.zoom = targetZoom;
    }

    let activeNpc: Npc | null = null;
    for (const npc of this.npcs) {
      const inRange = npc.update(this.player.x, this.player.y, time);
      if (inRange && !activeNpc) {
        activeNpc = npc;
      }
    }

    let activeDoorIsland: IllustratedIsland | null = null;
    if (this.illustratedIslands.size > 0) {
      for (const island of this.illustratedIslands.values()) {
        island.update(this.player.x, this.player.y, time);
        if (island.activeDoor && !activeDoorIsland) {
          activeDoorIsland = island;
        }
      }
    } else {
      this.centerIsland?.update(time);
      this.demoBuilding?.update(this.player.x, this.player.y, time);
    }

    if (this.controls.isInteractTriggered()) {
      if (activeNpc) {
        activeNpc.interact();
      } else if (activeDoorIsland) {
        activeDoorIsland.interact();
      } else if (this.demoBuilding?.isColliding(this.player.x, this.player.y)) {
        this.demoBuilding.interact();
      }
    }

    const isWalkable = (x: number, y: number): boolean => {
      if (this.bridgeRenderer?.isWalkable(x, y)) {
        return true;
      }
      for (const island of this.illustratedIslands.values()) {
        if (island.isInsideWalkable(x, y)) {
          return true;
        }
      }
      if (this.illustratedIslands.size === 0 && this.centerIsland) {
        return this.centerIsland.isInsideWalkable(x, y);
      }
      return false;
    };

    const isObstacle = (x: number, y: number): boolean =>
      this.illustratedIslands.size === 0 &&
      Boolean(this.demoBuilding?.isColliding(x, y));

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
      for (const isl of this.illustratedIslands.values()) {
        isl.destroy();
      }
      this.illustratedIslands.clear();
      this.bridgeRenderer?.destroy();
      this.bridgeRenderer = null;
      for (const npc of this.npcs) {
        npc.destroy();
      }
      this.npcs = [];
      this.demoBuilding = null;
      this.centerIsland = null;
      this.fx.destroy();
    });
  }
}
