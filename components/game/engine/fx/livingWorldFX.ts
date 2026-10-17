import Phaser from "phaser";
import { BirdSystem } from "./birds";
import { CloudSystem } from "./clouds";
import { GrassSystem } from "./grass";
import { LivingWorldPipeline } from "./islandPipeline";
import { ParticleSystem } from "./particles";
import { PerfManager } from "./perf";
import type { LivingWorldInitOptions } from "./types";

export class LivingWorldFX {
  private perf: PerfManager;
  private clouds: CloudSystem;
  private particles: ParticleSystem;
  private grass: GrassSystem;
  private birds: BirdSystem;
  private pipelineRegistered = false;
  private islandImage: Phaser.GameObjects.Image | null = null;
  private pipelineInstance: LivingWorldPipeline | null = null;

  constructor(private scene: Phaser.Scene) {
    this.perf = new PerfManager();
    this.clouds = new CloudSystem(scene);
    this.particles = new ParticleSystem(scene);
    this.grass = new GrassSystem(scene);
    this.birds = new BirdSystem(scene);

    this.pipelineRegistered = LivingWorldPipeline.register(scene.game);
  }

  public static preload(scene: Phaser.Scene): void {
    // Preload the development material map
    scene.load.image(
      "dev-island-material",
      "/game/islands/_dev/home.material.png"
    );

    // Preload sky backdrop if available in public/game/sky/sky.webp
    // Phaser will fail silently if not found, falling back to procedural gradient
    scene.load.image("sky-backdrop", "/game/sky/sky.webp");
  }

  public create(options: LivingWorldInitOptions = {}): void {
    const worldX = options.worldX ?? 0;
    const worldY = options.worldY ?? 0;
    const islandKey = options.islandImageKey ?? "dev-island-home";
    const materialKey = options.materialTextureKey ?? "dev-island-material";

    // 1. Locate the base island image in the scene and attach the Living World shader
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

    // 2. Initialize particles (waterfall spray, chimney smoke, fire glow)
    this.particles.initEmitters(worldX, worldY);

    // 3. Populate swaying grass tufts across grass pixels
    this.grass.populate(worldX, worldY, materialKey);

    // 4. Initialize bird flocks and roof perch sites
    this.birds.initPerchSites(worldX, worldY);
  }

  public update(
    time: number,
    delta: number,
    playerX?: number,
    playerY?: number
  ): void {
    this.perf.update(delta);
    const reduced = this.perf.isReducedMotion;
    const lowEnd = this.perf.isLowEnd;

    // Update island shader pipeline uniforms
    if (this.pipelineInstance) {
      this.pipelineInstance.setShaderTime(time * 0.001);
      this.pipelineInstance.setReducedMotion(reduced);
    }

    // Update individual living world effect systems
    this.clouds.update(delta, reduced);
    this.grass.update(time, playerX, playerY, reduced);
    this.birds.update(time, delta, reduced);
    this.particles.update(time, delta, reduced, lowEnd);
  }

  public resize(): void {
    this.clouds.resize();
  }

  public destroy(): void {
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
