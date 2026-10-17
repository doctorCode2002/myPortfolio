import type Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  alpha: number;
  maxLife: number;
  life: number;
  size: number;
  color: number;
  growth: number;
}

export interface WaterfallEmitter {
  x: number;
  y: number;
  width?: number;
}

export interface ChimneyEmitter {
  x: number;
  y: number;
}

export class ParticleSystem {
  private graphics: Phaser.GameObjects.Graphics;
  private glowGraphics: Phaser.GameObjects.Graphics;
  private particles: Particle[] = [];
  private waterfallEmitters: WaterfallEmitter[] = [];
  private chimneyEmitters: ChimneyEmitter[] = [];
  private fireGlows: Array<{ x: number; y: number; radius: number }> = [];

  private spraySpawnTimer = 0;
  private smokeSpawnTimer = 0;
  private readonly maxParticles = 90;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(ENGINE_CONSTANTS.DEPTHS.DETAILS + 5);

    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setDepth(ENGINE_CONSTANTS.DEPTHS.DETAILS + 4);
  }

  public initEmitters(
    worldX: number,
    worldY: number,
    waterfalls?: WaterfallEmitter[],
    chimneys?: ChimneyEmitter[]
  ): void {
    if (waterfalls && waterfalls.length > 0) {
      this.waterfallEmitters = waterfalls.map((w) => ({
        x: worldX + w.x,
        y: worldY + w.y,
        width: w.width ?? 16,
      }));
    } else {
      // Default waterfall base emitters on home island
      this.waterfallEmitters = [
        { x: worldX + 257, y: worldY + 726, width: 24 },
        { x: worldX + 542, y: worldY + 747, width: 18 },
        { x: worldX + 225, y: worldY + 1088, width: 20 },
      ];
    }

    if (chimneys && chimneys.length > 0) {
      this.chimneyEmitters = chimneys.map((c) => ({
        x: worldX + c.x,
        y: worldY + c.y,
      }));
    } else {
      // Forge and cottage chimneys
      this.chimneyEmitters = [
        { x: worldX + 630, y: worldY + 395 },
        { x: worldX + 545, y: worldY + 590 },
      ];
    }

    // Subtle warm fire glow only at the forge
    this.fireGlows = [{ x: worldX + 630, y: worldY + 555, radius: 14 }];
  }

  public setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    this.glowGraphics.setVisible(visible);
    if (!visible) {
      this.graphics.clear();
      this.glowGraphics.clear();
      this.particles = [];
    }
  }

  public update(
    time: number,
    delta: number,
    reducedMotion: boolean,
    lowEnd: boolean
  ): void {
    this.graphics.clear();
    this.glowGraphics.clear();

    if (reducedMotion) {
      this.particles = [];
      return;
    }

    const dt = Math.min(delta / 1000, 0.1);

    // Render soft additive fire glows
    for (const fg of this.fireGlows) {
      const pulse = Math.sin(time * 0.007 + fg.x) * 0.08;
      const alpha = 0.18 + pulse;
      this.glowGraphics.fillStyle(0xffaa33, Math.max(0.05, alpha));
      this.glowGraphics.fillCircle(fg.x, fg.y, fg.radius);
      this.glowGraphics.fillStyle(0xffdd66, Math.max(0.02, alpha * 0.6));
      this.glowGraphics.fillCircle(fg.x, fg.y, fg.radius * 0.5);
    }

    // Spawning logic
    const rateMul = lowEnd ? 0.4 : 1.0;
    this.spraySpawnTimer += dt * rateMul;
    this.smokeSpawnTimer += dt * rateMul;

    if (this.spraySpawnTimer >= 0.04) {
      this.spraySpawnTimer = 0;
      this.spawnWaterfallSpray();
    }

    if (this.smokeSpawnTimer >= 0.12) {
      this.smokeSpawnTimer = 0;
      this.spawnChimneySmoke();
    }

    // Update and draw existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.growth * dt;

      const progress = p.life / p.maxLife;
      const currentAlpha = p.alpha * (1 - progress);

      this.graphics.fillStyle(p.color, Math.max(0, currentAlpha));
      this.graphics.fillRect(
        Math.round(p.x),
        Math.round(p.y),
        Math.max(1, Math.round(p.size)),
        Math.max(1, Math.round(p.size))
      );
    }
  }

  private spawnWaterfallSpray(): void {
    if (this.particles.length >= this.maxParticles) return;

    for (const emitter of this.waterfallEmitters) {
      const w = emitter.width ?? 16;
      const px = emitter.x + (Math.random() - 0.5) * w;
      const py = emitter.y + (Math.random() - 0.5) * 4;

      this.particles.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 22,
        vy: -20 - Math.random() * 25,
        gravity: 65,
        alpha: 0.75,
        maxLife: 0.4 + Math.random() * 0.35,
        life: 0,
        size: Math.random() > 0.5 ? 2 : 1,
        color: 0xe5f6ff,
        growth: -0.8,
      });
    }
  }

  private spawnChimneySmoke(): void {
    if (this.particles.length >= this.maxParticles) return;

    for (const emitter of this.chimneyEmitters) {
      const px = emitter.x + (Math.random() - 0.5) * 4;
      const py = emitter.y;

      this.particles.push({
        x: px,
        y: py,
        vx: 3 + Math.random() * 5,
        vy: -14 - Math.random() * 10,
        gravity: -2,
        alpha: 0.32,
        maxLife: 1.2 + Math.random() * 0.6,
        life: 0,
        size: 2,
        color: 0xc8cdd8,
        growth: 3.5,
      });
    }
  }

  public destroy(): void {
    this.graphics.destroy();
    this.glowGraphics.destroy();
    this.particles = [];
  }
}
