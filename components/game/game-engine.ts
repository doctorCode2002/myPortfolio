import type Phaser from "phaser";
import {
  GAME_CONSTANTS,
  computeIntegerZoom,
  isInsideWalkableIsland,
} from "./game-constants";

interface CloudEntity {
  sprite: Phaser.GameObjects.Sprite;
  speed: number;
}

interface FloatingStoneEntity {
  graphics: Phaser.GameObjects.Graphics;
  baseY: number;
  offsetPhase: number;
}

export function createGame(
  container: HTMLElement,
  PhaserLib: typeof Phaser
): Phaser.Game {
  class PlayScene extends PhaserLib.Scene {
    private player!: Phaser.GameObjects.Sprite;
    private playerShadow!: Phaser.GameObjects.Graphics;
    private skyGraphics!: Phaser.GameObjects.Graphics;
    private clouds: CloudEntity[] = [];
    private floatingStones: FloatingStoneEntity[] = [];
    private keys: Record<string, Phaser.Input.Keyboard.Key> = {};

    private facing: "down" | "up" | "right" | "left" = "down";
    private tapTarget: { x: number; y: number } | null = null;
    private tapMarker?: Phaser.GameObjects.Graphics;

    // Touch joystick
    private joystickActive = false;
    private joystickOrigin = { x: 0, y: 0 };
    private joystickVector = { x: 0, y: 0 };
    private joystickBase!: Phaser.GameObjects.Graphics;
    private joystickThumb!: Phaser.GameObjects.Graphics;

    constructor() {
      super({ key: "PlayScene" });
    }

    preload(): void {
      this.load.spritesheet("player", "/game/characters/char_0.png", {
        frameWidth: GAME_CONSTANTS.PLAYER.FRAME_WIDTH,
        frameHeight: GAME_CONSTANTS.PLAYER.FRAME_HEIGHT,
      });
    }

    create(): void {
      this.createProceduralTextures();
      this.createSky();
      this.createParallaxClouds();
      this.createFloatingIsland();
      this.createPlayer();
      this.createAnimations();
      this.createTouchControls();
      this.createInputListeners();
      this.setupCamera();
      this.setupResizeListener();
    }

    private createProceduralTextures(): void {
      // Create 3 procedural cloud textures
      const cloudConfigs = [
        { key: "cloud_sm", w: 100, h: 50, scale: 0.8 },
        { key: "cloud_md", w: 140, h: 65, scale: 1.0 },
        { key: "cloud_lg", w: 190, h: 80, scale: 1.2 },
      ];

      for (const { key, w, h } of cloudConfigs) {
        if (!this.textures.exists(key)) {
          const canvas = this.textures.createCanvas(key, w, h);
          if (canvas) {
            const ctx = canvas.context;
            const cx = w / 2;
            const cy = h / 2 + 5;

            // Shadow / underside puffs
            ctx.fillStyle = "rgba(180, 198, 218, 0.85)";
            this.drawCloudPuffs(ctx, cx, cy + 4, w * 0.42, h * 0.35);

            // Bright white body
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            this.drawCloudPuffs(ctx, cx, cy, w * 0.38, h * 0.32);

            canvas.refresh();
          }
        }
      }
    }

    private drawCloudPuffs(
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      rx: number,
      ry: number
    ): void {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.ellipse(
        cx - rx * 0.5,
        cy + ry * 0.1,
        rx * 0.65,
        ry * 0.7,
        0,
        0,
        Math.PI * 2
      );
      ctx.ellipse(
        cx + rx * 0.5,
        cy + ry * 0.1,
        rx * 0.65,
        ry * 0.7,
        0,
        0,
        Math.PI * 2
      );
      ctx.ellipse(
        cx - rx * 0.2,
        cy - ry * 0.3,
        rx * 0.6,
        ry * 0.65,
        0,
        0,
        Math.PI * 2
      );
      ctx.ellipse(
        cx + rx * 0.25,
        cy - ry * 0.25,
        rx * 0.55,
        ry * 0.6,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    private createSky(): void {
      this.skyGraphics = this.add.graphics();
      this.skyGraphics.setScrollFactor(0);
      this.skyGraphics.setDepth(GAME_CONSTANTS.DEPTHS.SKY);
      this.renderSkyGradient(this.scale.width, this.scale.height);
    }

    private renderSkyGradient(w: number, h: number): void {
      this.skyGraphics.clear();
      // Celestial sky gradient: soft cornflower blue fading to warm cream haze
      this.skyGraphics.fillGradientStyle(
        0x507ea8,
        0x507ea8,
        0xe8e2d8,
        0xe8e2d8,
        1,
        1,
        1,
        1
      );
      this.skyGraphics.fillRect(0, 0, w, h);
    }

    private createParallaxClouds(): void {
      const { WORLD_HEIGHT, DEPTHS } = GAME_CONSTANTS;

      // Layer 1: Distant background clouds
      const bgClouds = [
        { x: 200, y: 150, key: "cloud_sm", speed: 8 },
        { x: 650, y: 220, key: "cloud_md", speed: 10 },
        { x: 1100, y: 130, key: "cloud_sm", speed: 9 },
        { x: 1450, y: 260, key: "cloud_md", speed: 11 },
        { x: 400, y: 380, key: "cloud_sm", speed: 9 },
        { x: 950, y: 420, key: "cloud_md", speed: 8 },
      ];

      for (const cfg of bgClouds) {
        const sprite = this.add.sprite(cfg.x, cfg.y, cfg.key);
        sprite.setScrollFactor(0.15);
        sprite.setAlpha(0.45);
        sprite.setScale(1.2);
        sprite.setDepth(DEPTHS.BACKGROUND_CLOUDS);
        this.clouds.push({ sprite, speed: cfg.speed });
      }

      // Layer 2: Midground clouds
      const midClouds = [
        { x: 100, y: 320, key: "cloud_md", speed: 18 },
        { x: 500, y: 240, key: "cloud_lg", speed: 22 },
        { x: 920, y: 340, key: "cloud_lg", speed: 20 },
        { x: 1350, y: 280, key: "cloud_md", speed: 24 },
        { x: 300, y: 780, key: "cloud_lg", speed: 19 },
        { x: 800, y: 880, key: "cloud_md", speed: 21 },
        { x: 1300, y: 820, key: "cloud_lg", speed: 23 },
      ];

      for (const cfg of midClouds) {
        const sprite = this.add.sprite(cfg.x, cfg.y, cfg.key);
        sprite.setScrollFactor(0.35);
        sprite.setAlpha(0.75);
        sprite.setScale(1.6);
        sprite.setDepth(DEPTHS.MIDGROUND_CLOUDS);
        this.clouds.push({ sprite, speed: cfg.speed });
      }

      // Layer 3: Faint lower foreground clouds
      const fgClouds = [
        { x: 250, y: WORLD_HEIGHT - 200, key: "cloud_lg", speed: 32 },
        { x: 850, y: WORLD_HEIGHT - 160, key: "cloud_lg", speed: 36 },
        { x: 1400, y: WORLD_HEIGHT - 220, key: "cloud_lg", speed: 30 },
      ];

      for (const cfg of fgClouds) {
        const sprite = this.add.sprite(cfg.x, cfg.y, cfg.key);
        sprite.setScrollFactor(0.55);
        sprite.setAlpha(0.25);
        sprite.setScale(2.4);
        sprite.setDepth(DEPTHS.FOREGROUND_CLOUDS);
        this.clouds.push({ sprite, speed: cfg.speed });
      }
    }

    private createFloatingIsland(): void {
      const { ISLAND, DEPTHS } = GAME_CONSTANTS;
      const { CENTER_X, CENTER_Y, SURFACE_RADIUS_X, SURFACE_RADIUS_Y } = ISLAND;

      // 1. Soft Island Shadow (floating in the sky below)
      const shadow = this.add.graphics();
      shadow.setDepth(DEPTHS.SHADOW);
      shadow.fillStyle(0x1a293d, 0.12);
      shadow.fillEllipse(CENTER_X, ISLAND.SHADOW_Y, 440, 110);
      shadow.fillStyle(0x1a293d, 0.18);
      shadow.fillEllipse(CENTER_X, ISLAND.SHADOW_Y, 280, 65);

      // 2. Rocky Underside tapering down
      const rock = this.add.graphics();
      rock.setDepth(DEPTHS.ROCK);

      // Main craggy rock silhouette tapering down to rugged roots
      // Left cliff edge: (CENTER_X - 220, CENTER_Y + 15)
      // Right cliff edge: (CENTER_X + 220, CENTER_Y + 15)
      rock.fillStyle(0x2f2520, 1); // Dark stone base
      rock.beginPath();
      rock.moveTo(CENTER_X - 220, CENTER_Y + 15);
      rock.lineTo(CENTER_X - 210, CENTER_Y + 45);
      rock.lineTo(CENTER_X - 180, CENTER_Y + 95);
      rock.lineTo(CENTER_X - 145, CENTER_Y + 140);
      rock.lineTo(CENTER_X - 110, CENTER_Y + 195);
      // Left root tip
      rock.lineTo(CENTER_X - 85, CENTER_Y + 235);
      rock.lineTo(CENTER_X - 70, CENTER_Y + 205);
      rock.lineTo(CENTER_X - 40, CENTER_Y + 245);
      // Center main deepest root tip
      rock.lineTo(CENTER_X - 5, CENTER_Y + 285);
      rock.lineTo(CENTER_X + 15, CENTER_Y + 275);
      rock.lineTo(CENTER_X + 45, CENTER_Y + 225);
      // Right root tip
      rock.lineTo(CENTER_X + 80, CENTER_Y + 210);
      rock.lineTo(CENTER_X + 95, CENTER_Y + 175);
      rock.lineTo(CENTER_X + 140, CENTER_Y + 130);
      rock.lineTo(CENTER_X + 185, CENTER_Y + 75);
      rock.lineTo(CENTER_X + 215, CENTER_Y + 35);
      rock.lineTo(CENTER_X + 220, CENTER_Y + 15);
      rock.closePath();
      rock.fillPath();

      // Lit facets (sunlight from top-left, warm stone)
      rock.fillStyle(0x4d3f37, 1);
      rock.beginPath();
      rock.moveTo(CENTER_X - 215, CENTER_Y + 20);
      rock.lineTo(CENTER_X - 170, CENTER_Y + 100);
      rock.lineTo(CENTER_X - 100, CENTER_Y + 175);
      rock.lineTo(CENTER_X - 75, CENTER_Y + 215);
      rock.lineTo(CENTER_X - 35, CENTER_Y + 160);
      rock.lineTo(CENTER_X - 60, CENTER_Y + 80);
      rock.lineTo(CENTER_X - 120, CENTER_Y + 30);
      rock.closePath();
      rock.fillPath();

      // Highlight stone ridges & strata
      rock.fillStyle(0x6b5a4f, 1);
      rock.beginPath();
      rock.moveTo(CENTER_X - 180, CENTER_Y + 40);
      rock.lineTo(CENTER_X - 140, CENTER_Y + 110);
      rock.lineTo(CENTER_X - 90, CENTER_Y + 140);
      rock.lineTo(CENTER_X - 115, CENTER_Y + 70);
      rock.closePath();
      rock.fillPath();

      // Center-left ridge highlight
      rock.fillStyle(0x7a685c, 1);
      rock.beginPath();
      rock.moveTo(CENTER_X - 50, CENTER_Y + 100);
      rock.lineTo(CENTER_X - 15, CENTER_Y + 190);
      rock.lineTo(CENTER_X - 5, CENTER_Y + 270);
      rock.lineTo(CENTER_X - 25, CENTER_Y + 200);
      rock.lineTo(CENTER_X - 45, CENTER_Y + 120);
      rock.closePath();
      rock.fillPath();

      // Deep shadow crevices on right
      rock.fillStyle(0x1e1714, 1);
      rock.beginPath();
      rock.moveTo(CENTER_X + 20, CENTER_Y + 110);
      rock.lineTo(CENTER_X + 50, CENTER_Y + 220);
      rock.lineTo(CENTER_X + 15, CENTER_Y + 270);
      rock.lineTo(CENTER_X + 30, CENTER_Y + 150);
      rock.closePath();
      rock.fillPath();

      // Detached floating satellite rocks hovering below the island
      const floatingRockConfigs = [
        { ox: -30, oy: 295, w: 14, h: 12, phase: 0 },
        { ox: 25, oy: 280, w: 10, h: 9, phase: 1.8 },
        { ox: -75, oy: 245, w: 12, h: 10, phase: 3.2 },
        { ox: 95, oy: 190, w: 16, h: 13, phase: 4.5 },
      ];

      for (const fr of floatingRockConfigs) {
        const stone = this.add.graphics();
        stone.setDepth(DEPTHS.ROCK);
        stone.fillStyle(0x3a2f29, 1);
        stone.fillEllipse(CENTER_X + fr.ox, CENTER_Y + fr.oy, fr.w, fr.h);
        stone.fillStyle(0x5a4b41, 1);
        stone.fillEllipse(
          CENTER_X + fr.ox - 2,
          CENTER_Y + fr.oy - 2,
          fr.w * 0.6,
          fr.h * 0.6
        );
        this.floatingStones.push({
          graphics: stone,
          baseY: CENTER_Y + fr.oy,
          offsetPhase: fr.phase,
        });
      }

      // 3. Dirt / Loam Lip underneath grass
      const dirt = this.add.graphics();
      dirt.setDepth(DEPTHS.DIRT);
      dirt.fillStyle(0x52341d, 1);
      dirt.fillEllipse(
        CENTER_X,
        CENTER_Y + 14,
        SURFACE_RADIUS_X * 2 + 6,
        SURFACE_RADIUS_Y * 2 + 10
      );

      // Hanging roots over cliff edge
      dirt.fillStyle(0x341e0d, 1);
      const rootOffsets = [-160, -110, -60, -10, 40, 90, 140, 180];
      for (const ro of rootOffsets) {
        const rootY =
          CENTER_Y +
          Math.sqrt(Math.max(0, 1 - Math.pow(ro / (SURFACE_RADIUS_X + 2), 2))) *
            SURFACE_RADIUS_Y +
          8;
        dirt.fillRect(CENTER_X + ro, rootY, 3, 7 + ((Math.abs(ro) * 7) % 9));
      }

      // 4. Lush Grass Top
      const grass = this.add.graphics();
      grass.setDepth(DEPTHS.GRASS);

      // Deep base grass rim
      grass.fillStyle(0x32612f, 1);
      grass.fillEllipse(
        CENTER_X,
        CENTER_Y + 2,
        SURFACE_RADIUS_X * 2,
        SURFACE_RADIUS_Y * 2
      );

      // Main vibrant meadow grass
      grass.fillStyle(0x448240, 1);
      grass.fillEllipse(
        CENTER_X,
        CENTER_Y,
        SURFACE_RADIUS_X * 2 - 4,
        SURFACE_RADIUS_Y * 2 - 4
      );

      // Sunlit meadow highlight
      grass.fillStyle(0x589d53, 1);
      grass.fillEllipse(
        CENTER_X - 10,
        CENTER_Y - 8,
        SURFACE_RADIUS_X * 1.6,
        SURFACE_RADIUS_Y * 1.5
      );

      // Jagged pixel grass tufts hanging over the lower rim
      grass.fillStyle(0x448240, 1);
      for (let angle = 0.15; angle < Math.PI - 0.15; angle += 0.08) {
        const gx = CENTER_X + Math.cos(angle) * (SURFACE_RADIUS_X - 4);
        const gy = CENTER_Y + Math.sin(angle) * (SURFACE_RADIUS_Y - 4);
        grass.fillTriangle(
          gx - 3,
          gy,
          gx + 3,
          gy,
          gx,
          gy + 5 + (Math.floor(gx * 3) % 4)
        );
      }

      // 5. Surface details: Wildflowers, stone pavers, clovers
      const details = this.add.graphics();
      details.setDepth(DEPTHS.DETAILS);

      // Subtle warm stepping stones near center
      details.fillStyle(0x948573, 0.8);
      const stones = [
        { x: -20, y: -10, rx: 7, ry: 4 },
        { x: -5, y: 15, rx: 8, ry: 5 },
        { x: 18, y: -5, rx: 6, ry: 4 },
        { x: 35, y: 20, rx: 9, ry: 5 },
        { x: -45, y: 8, rx: 7, ry: 4 },
      ];
      for (const s of stones) {
        details.fillEllipse(CENTER_X + s.x, CENTER_Y + s.y, s.rx * 2, s.ry * 2);
      }

      // Wildflower blossoms (golden yellow, terracotta orange, pure white)
      const flowers = [
        { x: -120, y: -20, col: 0xffd24d },
        { x: -115, y: -15, col: 0xffffff },
        { x: -90, y: 25, col: 0xe0703c },
        { x: -140, y: 10, col: 0xffd24d },
        { x: -60, y: -45, col: 0xffffff },
        { x: 70, y: -35, col: 0xffd24d },
        { x: 110, y: -15, col: 0xe0703c },
        { x: 135, y: 12, col: 0xffffff },
        { x: 85, y: 30, col: 0xffd24d },
        { x: 150, y: -10, col: 0xe0703c },
        { x: 30, y: -50, col: 0xffffff },
        { x: -30, y: 45, col: 0xffd24d },
      ];
      for (const f of flowers) {
        details.fillStyle(f.col, 1);
        details.fillRect(CENTER_X + f.x, CENTER_Y + f.y, 3, 3);
        details.fillStyle(0x2f522b, 1);
        details.fillRect(CENTER_X + f.x + 1, CENTER_Y + f.y + 3, 2, 2);
      }
    }

    private createPlayer(): void {
      const { PLAYER, DEPTHS } = GAME_CONSTANTS;

      // Soft shadow under player feet
      this.playerShadow = this.add.graphics();
      this.playerShadow.setDepth(DEPTHS.PLAYER_SHADOW);
      this.playerShadow.fillStyle(0x000000, 0.28);
      this.playerShadow.fillEllipse(PLAYER.START_X, PLAYER.START_Y + 13, 14, 6);

      // Character sprite
      this.player = this.add.sprite(
        PLAYER.START_X,
        PLAYER.START_Y,
        "player",
        1 // Default idle facing down (Row 0, Frame 1)
      );
      this.player.setOrigin(0.5, 0.5);
      this.player.setDepth(DEPTHS.PLAYER);
    }

    private createAnimations(): void {
      // 112x96 sheet, 7 frames per row of 16x32:
      // Row 0 = Facing DOWN: frames 0..6 (walk: 0..2, idle: 1)
      this.anims.create({
        key: "walk-down",
        frames: this.anims.generateFrameNumbers("player", {
          frames: [0, 1, 2, 1],
        }),
        frameRate: GAME_CONSTANTS.PLAYER.ANIM_FPS,
        repeat: -1,
      });

      // Row 1 = Facing UP: frames 7..13 (walk: 7..9, idle: 8)
      this.anims.create({
        key: "walk-up",
        frames: this.anims.generateFrameNumbers("player", {
          frames: [7, 8, 9, 8],
        }),
        frameRate: GAME_CONSTANTS.PLAYER.ANIM_FPS,
        repeat: -1,
      });

      // Row 2 = Facing RIGHT: frames 14..20 (walk: 14..16, idle: 15)
      // Facing LEFT = same Row 2 frames with setFlipX(true)
      this.anims.create({
        key: "walk-right",
        frames: this.anims.generateFrameNumbers("player", {
          frames: [14, 15, 16, 15],
        }),
        frameRate: GAME_CONSTANTS.PLAYER.ANIM_FPS,
        repeat: -1,
      });
    }

    private createTouchControls(): void {
      const { DEPTHS } = GAME_CONSTANTS;

      // Virtual joystick graphics (fixed to viewport)
      this.joystickBase = this.add.graphics();
      this.joystickBase.setScrollFactor(0);
      this.joystickBase.setDepth(DEPTHS.TOUCH_UI);
      this.joystickBase.setVisible(false);

      this.joystickThumb = this.add.graphics();
      this.joystickThumb.setScrollFactor(0);
      this.joystickThumb.setDepth(DEPTHS.TOUCH_UI + 1);
      this.joystickThumb.setVisible(false);

      // Tap marker graphic
      this.tapMarker = this.add.graphics();
      this.tapMarker.setDepth(DEPTHS.DETAILS);
      this.tapMarker.setVisible(false);

      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        // Ignore clicks on overlay UI elements
        const target = pointer.event.target as HTMLElement | null;
        if (target && target.closest(".pointer-events-auto")) {
          return;
        }

        this.joystickActive = true;
        this.joystickOrigin = { x: pointer.x, y: pointer.y };
        this.joystickVector = { x: 0, y: 0 };

        this.drawJoystick(pointer.x, pointer.y, pointer.x, pointer.y);
        this.joystickBase.setVisible(true);
        this.joystickThumb.setVisible(true);
      });

      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (!this.joystickActive || !pointer.isDown) return;

        const dx = pointer.x - this.joystickOrigin.x;
        const dy = pointer.y - this.joystickOrigin.y;
        const dist = Math.hypot(dx, dy);
        const maxRadius = 38;

        if (dist > 6) {
          // Player is dragging joystick: cancel tap target
          this.tapTarget = null;
          if (this.tapMarker) this.tapMarker.setVisible(false);

          const clampedDist = Math.min(dist, maxRadius);
          const thumbX = this.joystickOrigin.x + (dx / dist) * clampedDist;
          const thumbY = this.joystickOrigin.y + (dy / dist) * clampedDist;

          this.joystickVector = {
            x: dx / dist,
            y: dy / dist,
          };
          this.drawJoystick(
            this.joystickOrigin.x,
            this.joystickOrigin.y,
            thumbX,
            thumbY
          );
        }
      });

      this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (!this.joystickActive) return;

        const dx = pointer.x - this.joystickOrigin.x;
        const dy = pointer.y - this.joystickOrigin.y;
        const dist = Math.hypot(dx, dy);

        // If distance was very small, treat as a tap-to-move click!
        if (dist <= 8) {
          const worldPoint = this.cameras.main.getWorldPoint(
            pointer.x,
            pointer.y
          );
          if (isInsideWalkableIsland(worldPoint.x, worldPoint.y)) {
            this.tapTarget = { x: worldPoint.x, y: worldPoint.y };
            this.showTapMarker(worldPoint.x, worldPoint.y);
          }
        }

        this.joystickActive = false;
        this.joystickVector = { x: 0, y: 0 };
        this.joystickBase.setVisible(false);
        this.joystickThumb.setVisible(false);
      });
    }

    private drawJoystick(bx: number, by: number, tx: number, ty: number): void {
      this.joystickBase.clear();
      this.joystickBase.fillStyle(0xffffff, 0.18);
      this.joystickBase.fillCircle(bx, by, 38);
      this.joystickBase.lineStyle(2, 0xffffff, 0.45);
      this.joystickBase.strokeCircle(bx, by, 38);

      this.joystickThumb.clear();
      this.joystickThumb.fillStyle(0xffffff, 0.7);
      this.joystickThumb.fillCircle(tx, ty, 16);
      this.joystickThumb.lineStyle(2, 0xab4c24, 0.8);
      this.joystickThumb.strokeCircle(tx, ty, 16);
    }

    private showTapMarker(x: number, y: number): void {
      if (!this.tapMarker) return;
      this.tapMarker.clear();
      this.tapMarker.lineStyle(2, 0xffffff, 0.8);
      this.tapMarker.strokeCircle(x, y, 8);
      this.tapMarker.setVisible(true);

      this.tweens.add({
        targets: this.tapMarker,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 1.8 },
        duration: 350,
        onComplete: () => {
          if (this.tapMarker) {
            this.tapMarker.setVisible(false);
            this.tapMarker.setAlpha(1);
            this.tapMarker.setScale(1);
          }
        },
      });
    }

    private createInputListeners(): void {
      if (this.input.keyboard) {
        this.keys = this.input.keyboard.addKeys({
          up: PhaserLib.Input.Keyboard.KeyCodes.UP,
          down: PhaserLib.Input.Keyboard.KeyCodes.DOWN,
          left: PhaserLib.Input.Keyboard.KeyCodes.LEFT,
          right: PhaserLib.Input.Keyboard.KeyCodes.RIGHT,
          w: PhaserLib.Input.Keyboard.KeyCodes.W,
          s: PhaserLib.Input.Keyboard.KeyCodes.S,
          a: PhaserLib.Input.Keyboard.KeyCodes.A,
          d: PhaserLib.Input.Keyboard.KeyCodes.D,
        }) as Record<string, Phaser.Input.Keyboard.Key>;
      }
    }

    private setupCamera(): void {
      const { WORLD_WIDTH, WORLD_HEIGHT } = GAME_CONSTANTS;
      const cam = this.cameras.main;
      cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      cam.startFollow(this.player, true, 0.08, 0.08);

      const zoom = computeIntegerZoom(this.scale.width, this.scale.height);
      cam.setZoom(zoom);
    }

    private setupResizeListener(): void {
      this.scale.on(
        "resize",
        (gameSize: Phaser.Structs.Size) => {
          const w = gameSize.width;
          const h = gameSize.height;

          this.renderSkyGradient(w, h);

          const zoom = computeIntegerZoom(w, h);
          this.cameras.main.setZoom(zoom);
        },
        this
      );
    }

    override update(time: number, delta: number): void {
      const dt = delta / 1000;

      // 1. Drift Parallax Clouds
      const wrapBound = GAME_CONSTANTS.WORLD_WIDTH + 260;
      for (const cloud of this.clouds) {
        cloud.sprite.x += cloud.speed * dt;
        if (cloud.sprite.x > wrapBound) {
          cloud.sprite.x = -240;
        }
      }

      // 2. Gentle bobbing animation for floating rocks
      for (const stone of this.floatingStones) {
        const bob = Math.sin(time * 0.002 + stone.offsetPhase) * 3;
        stone.graphics.y = bob;
      }

      // 3. Gather user input
      let moveX = 0;
      let moveY = 0;

      // Keyboard input
      if (this.keys["left"]?.isDown || this.keys["a"]?.isDown) moveX -= 1;
      if (this.keys["right"]?.isDown || this.keys["d"]?.isDown) moveX += 1;
      if (this.keys["up"]?.isDown || this.keys["w"]?.isDown) moveY -= 1;
      if (this.keys["down"]?.isDown || this.keys["s"]?.isDown) moveY += 1;

      // If keyboard key was pressed, cancel tap target
      if (moveX !== 0 || moveY !== 0) {
        this.tapTarget = null;
      }

      // Virtual joystick input
      if (
        this.joystickActive &&
        (this.joystickVector.x !== 0 || this.joystickVector.y !== 0)
      ) {
        moveX = this.joystickVector.x;
        moveY = this.joystickVector.y;
        this.tapTarget = null;
      }

      // Tap-to-move destination navigation
      if (this.tapTarget && moveX === 0 && moveY === 0) {
        const toX = this.tapTarget.x - this.player.x;
        const toY = this.tapTarget.y - this.player.y;
        const dist = Math.hypot(toX, toY);

        if (dist > 4) {
          moveX = toX / dist;
          moveY = toY / dist;
        } else {
          this.tapTarget = null;
        }
      }

      const isMoving = moveX !== 0 || moveY !== 0;

      if (isMoving) {
        // Normalize movement vector if magnitude > 1
        const mag = Math.hypot(moveX, moveY);
        const normX = mag > 1 ? moveX / mag : moveX;
        const normY = mag > 1 ? moveY / mag : moveY;

        // Facing direction & animation selection
        if (Math.abs(normX) > Math.abs(normY)) {
          if (normX > 0) {
            this.facing = "right";
            this.player.setFlipX(false);
            this.player.anims.play("walk-right", true);
          } else {
            this.facing = "left";
            this.player.setFlipX(true);
            this.player.anims.play("walk-right", true);
          }
        } else {
          if (normY > 0) {
            this.facing = "down";
            this.player.setFlipX(false);
            this.player.anims.play("walk-down", true);
          } else {
            this.facing = "up";
            this.player.setFlipX(false);
            this.player.anims.play("walk-up", true);
          }
        }

        // Apply velocity with island edge collision & wall-sliding
        const speed = GAME_CONSTANTS.PLAYER.SPEED;
        const targetX = this.player.x + normX * speed * dt;
        const targetY = this.player.y + normY * speed * dt;

        // Feet collision offset (feet are at Y + 12 relative to center)
        const feetOffsetY = 12;

        if (isInsideWalkableIsland(targetX, targetY + feetOffsetY)) {
          this.player.x = targetX;
          this.player.y = targetY;
        } else {
          // Slide along X if possible
          if (isInsideWalkableIsland(targetX, this.player.y + feetOffsetY)) {
            this.player.x = targetX;
          }
          // Slide along Y if possible
          if (isInsideWalkableIsland(this.player.x, targetY + feetOffsetY)) {
            this.player.y = targetY;
          }
        }
      } else {
        // Idle state: stop animation and display correct idle frame
        this.player.anims.stop();
        switch (this.facing) {
          case "down":
            this.player.setFrame(1);
            this.player.setFlipX(false);
            break;
          case "up":
            this.player.setFrame(8);
            this.player.setFlipX(false);
            break;
          case "right":
            this.player.setFrame(15);
            this.player.setFlipX(false);
            break;
          case "left":
            this.player.setFrame(15);
            this.player.setFlipX(true);
            break;
        }
      }

      // Update player shadow position
      this.playerShadow.x = this.player.x - GAME_CONSTANTS.PLAYER.START_X;
      this.playerShadow.y = this.player.y - GAME_CONSTANTS.PLAYER.START_Y;
    }
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: PhaserLib.AUTO,
    parent: container,
    width: container.clientWidth || window.innerWidth,
    height: container.clientHeight || window.innerHeight,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#507ea8",
    scale: {
      mode: PhaserLib.Scale.RESIZE,
      autoCenter: PhaserLib.Scale.CENTER_BOTH,
    },
    scene: [PlayScene],
  };

  return new PhaserLib.Game(config);
}
