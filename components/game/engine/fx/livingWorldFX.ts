import Phaser from "phaser";
import { BirdSystem } from "./birds";
import { CloudSystem } from "./clouds";
import { GrassSystem } from "./grass";
import { LivingWorldPipeline } from "./islandPipeline";
import { ParticleSystem } from "./particles";
import { PerfManager } from "./perf";
import type { LivingWorldInitOptions } from "./types";

declare global {
  interface Window {
    __TOGGLE_FX__?: () => boolean;
    __SET_FX__?: (enabled: boolean) => void;
  }
}

export class LivingWorldFX {
  private perf: PerfManager;
  private clouds: CloudSystem;
  private particles: ParticleSystem;
  private grass: GrassSystem;
  private birds: BirdSystem;
  private pipelineRegistered = false;
  private islandImages: Phaser.GameObjects.Image[] = [];
  private pipelineInstances: LivingWorldPipeline[] = [];
  private isEnabled = true;

  constructor(private scene: Phaser.Scene) {
    this.perf = new PerfManager();
    this.clouds = new CloudSystem(scene);
    this.particles = new ParticleSystem(scene);
    this.grass = new GrassSystem(scene);
    this.birds = new BirdSystem(scene);

    this.pipelineRegistered = LivingWorldPipeline.register(scene.game);
  }

  public static preload(scene: Phaser.Scene): void {
    scene.load.image("sky-backdrop", "/game/sky/sky.webp");
  }

  public create(options: LivingWorldInitOptions = {}): void {
    // 1. World bounds for celestial clouds and sky backdrop
    if (options.worldBounds) {
      this.clouds.setWorldBounds(
        options.worldBounds.width,
        options.worldBounds.height
      );
    }

    // 2. Initialize multiple islands or fallback single island
    const islands =
      options.islands && options.islands.length > 0
        ? options.islands
        : [
            {
              id: "home",
              worldX: options.worldX ?? 0,
              worldY: options.worldY ?? 0,
              width: options.islandArt?.size.w ?? 800,
              height: options.islandArt?.size.h ?? 1134,
              islandImageKey: options.islandImageKey ?? "dev-island-home",
              materialTextureKey:
                options.materialTextureKey ?? "dev-island-material",
            },
          ];

    for (const isl of islands) {
      // Find island base image in scene
      const baseImg = this.scene.children.list.find(
        (obj) =>
          obj instanceof Phaser.GameObjects.Image &&
          obj.texture.key === isl.islandImageKey
      ) as Phaser.GameObjects.Image | undefined;

      if (baseImg && this.pipelineRegistered) {
        this.islandImages.push(baseImg);
        baseImg.setPostPipeline(LivingWorldPipeline.PIPELINE_NAME);
        const postPipelines = baseImg.getPostPipeline(
          LivingWorldPipeline.PIPELINE_NAME
        );
        if (postPipelines) {
          const pipe = Array.isArray(postPipelines)
            ? (postPipelines[0] as LivingWorldPipeline)
            : (postPipelines as LivingWorldPipeline);
          pipe.setMaterialTextureKey(isl.materialTextureKey);
          this.pipelineInstances.push(pipe);
        }
      }

      // Populate grass tufts across this island
      this.grass.populateIsland(
        isl.worldX,
        isl.worldY,
        isl.width,
        isl.height,
        isl.materialTextureKey,
        isl.islandImageKey
      );

      // Initialize bird perch sites and emitters
      if (isl.id === "home") {
        this.particles.initEmitters(isl.worldX, isl.worldY);
        this.birds.initPerchSites(isl.worldX, isl.worldY);
      }
    }

    // 3. Debug toggle keyboard shortcut: Pressing "F" toggles all FX on/off
    this.scene.input.keyboard?.on("keydown-F", () => {
      this.toggle();
    });

    // 4. Expose debug toggle to window for console / screenshot automation
    if (typeof window !== "undefined") {
      window.__TOGGLE_FX__ = () => this.toggle();
      window.__SET_FX__ = (enabled: boolean) => this.setEnabled(enabled);

      if (window.location.search.includes("fx=0")) {
        this.setEnabled(false);
      }
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    // Toggle all shader pipeline instances
    for (const pipe of this.pipelineInstances) {
      pipe.setReducedMotion(!enabled || this.perf.isReducedMotion);
    }

    // Toggle all living entity systems
    this.particles.setVisible(enabled);
    this.grass.setVisible(enabled);
    this.birds.setVisible(enabled);
    this.clouds.setVisible(enabled);

    console.log(`[LivingWorldFX] Effects ${enabled ? "ENABLED" : "DISABLED"}`);
  }

  public get enabled(): boolean {
    return this.isEnabled;
  }

  public update(
    time: number,
    delta: number,
    playerX?: number,
    playerY?: number,
    cullRect?: { x: number; y: number; width: number; height: number }
  ): void {
    if (!this.isEnabled) return;

    this.perf.update(delta);
    const reduced = this.perf.isReducedMotion;
    const lowEnd = this.perf.isLowEnd;

    for (const pipe of this.pipelineInstances) {
      pipe.setShaderTime(time * 0.001);
      pipe.setReducedMotion(reduced);
    }

    this.clouds.update(delta, reduced);
    this.grass.update(time, playerX, playerY, reduced, cullRect);
    this.birds.update(time, delta, reduced);
    this.particles.update(time, delta, reduced, lowEnd);
  }

  public resize(): void {
    this.clouds.resize();
  }

  public destroy(): void {
    if (typeof window !== "undefined") {
      delete window.__TOGGLE_FX__;
      delete window.__SET_FX__;
    }

    this.perf.destroy();
    this.clouds.destroy();
    this.particles.destroy();
    this.grass.destroy();
    this.birds.destroy();

    if (this.pipelineRegistered) {
      for (const img of this.islandImages) {
        img.removePostPipeline(LivingWorldPipeline.PIPELINE_NAME);
      }
    }
    this.islandImages = [];
    this.pipelineInstances = [];
  }
}
