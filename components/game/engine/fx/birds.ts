import Phaser from "phaser";
import { ENGINE_CONSTANTS } from "../constants";
import type { PerchSite } from "./types";

interface BirdEntity {
  sprite: Phaser.GameObjects.Sprite;
  state: "flying" | "landing" | "perched" | "taking_off";
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
  private initialSpawnDone = false;
  private isVisible = true;
  private readonly textureKey = "fx_bird_sprite_7px";

  constructor(private scene: Phaser.Scene) {
    this.createBirdTexture();
  }

  private createBirdTexture(): void {
    if (this.scene.textures.exists(this.textureKey)) return;

    // 2 frames side by side: [0]=wings up, [1]=wings flat/down (each 7x5 on a 16x5 canvas)
    const canvas = this.scene.textures.createCanvas(this.textureKey, 16, 5);
    if (!canvas) return;

    const ctx = canvas.context;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = "#222731";
    const f0 = [".#...#.", "###.###", "..###..", "...#...", "...#..."];
    const f1 = ["...#...", ".#####.", "#..#..#", "...#...", "...#..."];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 7; x++) {
        if (f0[y]?.[x] === "#") ctx.fillRect(x, y, 1, 1);
        if (f1[y]?.[x] === "#") ctx.fillRect(8 + x, y, 1, 1);
      }
    }

    canvas.refresh();
    const tex = this.scene.textures.get(this.textureKey);
    tex.add("bird_0", 0, 0, 0, 7, 5);
    tex.add("bird_1", 0, 8, 0, 7, 5);
  }

  public initPerchSites(worldX: number, worldY: number): void {
    const raw = [
      [395, 265, 430],
      [165, 402, 500],
      [630, 402, 500],
      [165, 598, 675],
      [610, 598, 675],
    ];
    this.perchSites = raw.map(([ox, oy, od], idx) => ({
      id: `p_${idx}`,
      x: worldX + (ox ?? 0),
      y: worldY + (oy ?? 0),
      depth: worldY + (od ?? 0),
      occupied: false,
    }));
  }

  public update(time: number, delta: number, reducedMotion = false): void {
    if (reducedMotion || !this.isVisible) {
      for (const b of this.birds) b.sprite.setVisible(false);
      return;
    }

    const dt = Math.min(delta / 1000, 0.1);
    this.spawnTimer += dt;

    const cam = this.scene.cameras?.main;
    const wv = cam?.worldView;

    // Spawn first flock across the player's view at 5.5s
    if (!this.initialSpawnDone && this.spawnTimer >= 5.5) {
      this.initialSpawnDone = true;
      this.spawnTimer = 0;
      const startX = wv ? wv.x - 40 : 400;
      const startY = wv ? wv.y + 60 : 350;
      this.spawnFlock(startX, startY, 1);
    } else if (this.initialSpawnDone && this.spawnTimer > 18) {
      this.spawnTimer = 0;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const startX = wv
        ? dir > 0
          ? wv.x - 40
          : wv.right + 40
        : dir > 0
          ? 350
          : 1250;
      const startY = (wv ? wv.y : 300) + 40 + Math.random() * 120;
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

        const flapCycle = b.flapTimer % 2.8;
        if (flapCycle < 1.3) {
          b.sprite.setFrame(
            Math.floor(flapCycle * 8) % 2 === 0 ? "bird_0" : "bird_1"
          );
        } else {
          b.sprite.setFrame("bird_1");
        }

        // Perch check near free site
        if (b.stateTimer > 2.5) {
          const site = this.perchSites.find(
            (p) =>
              !p.occupied &&
              Math.abs(b.x - p.x) < 45 &&
              Math.abs(b.y - p.y) < 65
          );
          if (site && Math.random() < 0.4) {
            site.occupied = true;
            b.perchSite = site;
            b.state = "landing";
            b.stateTimer = 0;
            b.sprite.setDepth(site.depth);
          }
        }

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
        b.x = Phaser.Math.Linear(b.x, b.perchSite.x, 0.07);
        b.y = Phaser.Math.Linear(b.y, b.perchSite.y, 0.07);
        b.sprite.setFrame("bird_1");
        if (Math.hypot(b.x - b.perchSite.x, b.y - b.perchSite.y) < 3) {
          b.x = b.perchSite.x;
          b.y = b.perchSite.y;
          b.state = "perched";
          b.stateTimer = 0;
        }
      } else if (b.state === "perched") {
        b.sprite
          .setFrame("bird_1")
          .setPosition(b.x, b.y + (Math.sin(time * 0.006) > 0.85 ? 1 : 0));
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
          b.sprite.setDepth(45);
        }
      }

      b.sprite.setPosition(Math.round(b.x), Math.round(b.y));
    }
  }

  private spawnFlock(startX: number, startY: number, dir: number): void {
    const flockSize = 3 + Math.floor(Math.random() * 4); // 3 to 6 birds
    const baseSpeed = 55 + Math.random() * 15;

    for (let i = 0; i < flockSize; i++) {
      const offsetX = -dir * (i * 20 + (Math.random() - 0.5) * 12);
      const offsetY = (Math.random() - 0.5) * 36;
      const bx = startX + offsetX;
      const by = startY + offsetY;

      const sprite = this.scene.add.sprite(bx, by, this.textureKey, "bird_0");
      sprite.setDepth(45);
      sprite.setFlipX(dir < 0);
      sprite.setVisible(this.isVisible);

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

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    for (const b of this.birds) {
      b.sprite.setVisible(visible);
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
