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
  private islandImage: Phaser.GameObjects.Image | null = null;
  private pipelineInstance: LivingWorldPipeline | null = null;
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
    scene.load.image(
      "dev-island-material",
      "/game/islands/_dev/home.material.png"
    );
    scene.load.image("sky-backdrop", "/game/sky/sky.webp");
  }

  public create(options: LivingWorldInitOptions = {}): void {
    const worldX = options.worldX ?? 0;
    const worldY = options.worldY ?? 0;
    const islandKey = options.islandImageKey ?? "dev-island-home";
    const materialKey = options.materialTextureKey ?? "dev-island-material";

    // 1. Locate island base image and attach pipeline
    const baseImg = this.scene.children.list.find(
      (obj) =>
        obj instanceof Phaser.GameObjects.Image && obj.texture.key === islandKey
    ) as Phaser.GameObjects.Image | undefined;

    if (baseImg && this.pipelineRegistered) {
      this.islandImage = baseImg;
      baseImg.setPostPipeline(LivingWorldPipeline.PIPELINE_NAME);
      const postPipelines = baseImg.getPostPipeline(
        LivingWorldPipeline.PIPELINE_NAME
      );
      if (postPipelines) {
        this.pipelineInstance = Array.isArray(postPipelines)
          ? (postPipelines[0] as LivingWorldPipeline)
          : (postPipelines as LivingWorldPipeline);
        this.pipelineInstance.setMaterialTextureKey(materialKey);
      }
    }

    // 2. Initialize subsystems
    this.particles.initEmitters(worldX, worldY);
    this.grass.populate(worldX, worldY, materialKey);
    this.birds.initPerchSites(worldX, worldY);

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

    // Toggle shader pipeline
    if (this.pipelineInstance) {
      this.pipelineInstance.setReducedMotion(
        !enabled || this.perf.isReducedMotion
      );
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
    playerY?: number
  ): void {
    if (!this.isEnabled) return;

    this.perf.update(delta);
    const reduced = this.perf.isReducedMotion;
    const lowEnd = this.perf.isLowEnd;

    if (this.pipelineInstance) {
      this.pipelineInstance.setShaderTime(time * 0.001);
      this.pipelineInstance.setReducedMotion(reduced);
    }

    this.clouds.update(delta, reduced);
    this.grass.update(time, playerX, playerY, reduced);
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

    if (this.islandImage && this.pipelineRegistered) {
      this.islandImage.removePostPipeline(LivingWorldPipeline.PIPELINE_NAME);
    }
    this.islandImage = null;
    this.pipelineInstance = null;
  }
}
