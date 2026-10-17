import Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";
import type { PerchSite } from "./types";

type BirdState = "flying" | "landing" | "perched" | "taking_off";

interface BirdEntity {
  sprite: Phaser.GameObjects.Sprite;
  state: BirdState;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseY: number;
  phase: number;
  flapTimer: number;
  stateTimer: number;
  perchSite: PerchSite | null;
}

export class BirdSystem {
  private birds: BirdEntity[] = [];
  private perchSites: PerchSite[] = [];
  private spawnTimer = 0;
  private readonly textureKey = "fx_bird_sprite";

  constructor(private scene: Phaser.Scene) {
    this.createBirdTexture();
  }

  private createBirdTexture(): void {
    if (this.scene.textures.exists(this.textureKey)) return;

    // 2 frames side by side: [0]=wings up, [1]=wings flat/down
    const canvas = this.scene.textures.createCanvas(this.textureKey, 12, 6);
    if (!canvas) return;

    const ctx = canvas.context;
    ctx.imageSmoothingEnabled = false;

    // Frame 0: Wings up (x: 0..5)
    ctx.fillStyle = "#2c333f";
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 1, 1, 1);
    ctx.fillRect(0, 2, 6, 1);
    ctx.fillRect(2, 3, 2, 1);

    // Frame 1: Wings down/flat (x: 6..11)
    ctx.fillStyle = "#2c333f";
    ctx.fillRect(6 + 2, 1, 2, 1);
    ctx.fillRect(6 + 0, 2, 6, 1);
    ctx.fillRect(6 + 0, 3, 1, 1);
    ctx.fillRect(6 + 5, 3, 1, 1);
    ctx.fillRect(6 + 2, 3, 2, 1);

    canvas.refresh();

    const tex = this.scene.textures.get(this.textureKey);
    tex.add("bird_0", 0, 0, 0, 6, 6);
    tex.add("bird_1", 0, 6, 0, 6, 6);
  }

  public initPerchSites(worldX: number, worldY: number): void {
    // Known roof ridge coordinates on the home island
    const offsets = [
      { id: "castle_arch", ox: 395, oy: 265, od: 430 },
      { id: "academy_roof", ox: 165, oy: 402, od: 500 },
      { id: "forge_roof", ox: 630, oy: 402, od: 500 },
      { id: "pavilion_roof", ox: 165, oy: 598, od: 675 },
      { id: "cottage_roof", ox: 610, oy: 598, od: 675 },
    ];
    this.perchSites = offsets.map((o) => ({
      id: o.id,
      x: worldX + o.ox,
      y: worldY + o.oy,
      depth: worldY + o.od,
      occupied: false,
    }));

    // Spawn an initial gentle flock crossing the sky
    this.spawnFlock(-60, 220, 1);
  }

  public update(time: number, delta: number, reducedMotion = false): void {
    if (reducedMotion) {
      for (const b of this.birds) {
        b.sprite.setVisible(false);
      }
      return;
    }

    const dt = Math.min(delta / 1000, 0.1);
    this.spawnTimer += dt;

    // Periodically spawn a new flock
    if (this.spawnTimer > 18) {
      this.spawnTimer = 0;
      const startX =
        Math.random() > 0.5 ? -60 : ENGINE_CONSTANTS.WORLD_WIDTH + 60;
      const startY = 140 + Math.random() * 220;
      const dir = startX < 0 ? 1 : -1;
      this.spawnFlock(startX, startY, dir);
    }

    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      if (!b) continue;

      b.flapTimer += dt;
      b.stateTimer += dt;

      if (b.state === "flying") {
        b.x += b.vx * dt;
        b.y = b.baseY + Math.sin(time * 0.003 + b.phase) * 12;

        // Flap cycle: 1.2s flapping, 1.8s gliding
        const flapCycle = b.flapTimer % 3.0;
        if (flapCycle < 1.2) {
          b.sprite.setFrame(
            Math.floor(flapCycle * 9) % 2 === 0 ? "bird_0" : "bird_1"
          );
        } else {
          b.sprite.setFrame("bird_1");
        }

        // Try perching if near a free perch site
        if (b.stateTimer > 3.0) {
          const site = this.perchSites.find(
            (p) =>
              !p.occupied &&
              Math.abs(b.x - p.x) < 45 &&
              Math.abs(b.y - p.y) < 65
          );
          if (site && Math.random() < 0.45) {
            site.occupied = true;
            b.perchSite = site;
            b.state = "landing";
            b.stateTimer = 0;
            b.sprite.setDepth(site.depth);
          }
        }

        // Despawn when far out of bounds
        if (b.x < -120 || b.x > ENGINE_CONSTANTS.WORLD_WIDTH + 120) {
          b.sprite.destroy();
          this.birds.splice(i, 1);
          continue;
        }
      } else if (b.state === "landing") {
        if (!b.perchSite) {
          b.state = "flying";
          continue;
        }
        b.x = Phaser.Math.Linear(b.x, b.perchSite.x, 0.06);
        b.y = Phaser.Math.Linear(b.y, b.perchSite.y, 0.06);
        b.sprite.setFrame("bird_1");

        if (Math.hypot(b.x - b.perchSite.x, b.y - b.perchSite.y) < 3) {
          b.x = b.perchSite.x;
          b.y = b.perchSite.y;
          b.state = "perched";
          b.stateTimer = 0;
        }
      } else if (b.state === "perched") {
        b.sprite.setFrame("bird_1");
        // Tiny head peck / hop every 1.8s
        const bob = Math.sin(time * 0.006) > 0.85 ? 1 : 0;
        b.sprite.setPosition(b.x, b.y + bob);

        // Perch for 5 to 9 seconds then take off
        if (b.stateTimer > 5.0 + (b.phase % 4)) {
          b.state = "taking_off";
          b.stateTimer = 0;
          b.vy = -35;
          if (b.perchSite) b.perchSite.occupied = false;
          b.perchSite = null;
        }
        continue;
      } else if (b.state === "taking_off") {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.sprite.setFrame(
          Math.floor(b.flapTimer * 10) % 2 === 0 ? "bird_0" : "bird_1"
        );

        if (b.stateTimer > 1.2) {
          b.state = "flying";
          b.baseY = b.y;
          b.sprite.setDepth(ENGINE_CONSTANTS.DEPTHS.MIDGROUND_CLOUDS + 1);
        }
      }

      b.sprite.setPosition(Math.round(b.x), Math.round(b.y));
    }
  }

  private spawnFlock(startX: number, startY: number, dir: number): void {
    const flockSize = 3 + Math.floor(Math.random() * 4); // 3 to 6 birds
    const baseSpeed = 55 + Math.random() * 15;

    for (let i = 0; i < flockSize; i++) {
      const offsetX = -dir * (i * 18 + (Math.random() - 0.5) * 12);
      const offsetY = (Math.random() - 0.5) * 36;
      const bx = startX + offsetX;
      const by = startY + offsetY;

      const sprite = this.scene.add.sprite(bx, by, this.textureKey, "bird_0");
      sprite.setDepth(ENGINE_CONSTANTS.DEPTHS.MIDGROUND_CLOUDS + 1);
      sprite.setFlipX(dir < 0);

      this.birds.push({
        sprite,
        state: "flying",
        x: bx,
        y: by,
        vx: dir * baseSpeed,
        vy: 0,
        baseY: by,
        phase: Math.random() * Math.PI * 2,
        flapTimer: Math.random() * 2,
        stateTimer: 0,
        perchSite: null,
      });
    }
  }

  public destroy(): void {
    for (const b of this.birds) {
      b.sprite.destroy();
    }
    this.birds = [];
    this.perchSites = [];
  }
}
