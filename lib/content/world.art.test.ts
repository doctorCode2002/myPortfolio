import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processIsland } from "../../scripts/art/process-island.mjs";
import { type IslandArt, validateIslandArt } from "./world.art";

const SAMPLE_VALID_ART: IslandArt = {
  version: 1,
  size: { w: 800, h: 1000 },
  walkable: [
    [
      [100, 200],
      [700, 200],
      [700, 800],
      [100, 800],
      [100, 200], // closed
    ],
  ],
  blockers: [
    [
      [300, 400],
      [500, 400],
      [500, 600],
      [300, 600],
      [300, 400], // closed
    ],
  ],
  occluders: [
    {
      id: "castle_roof",
      rect: [250, 300, 300, 150],
      baseY: 450,
    },
  ],
  doors: [
    {
      buildingId: "building_education",
      at: [200, 350],
      radius: 24,
    },
  ],
  spawns: {
    player: [400, 700],
    mayor: [450, 700],
  },
  anchors: [
    {
      id: "to_khidmty",
      at: [400, 100],
    },
    {
      id: "to_saleh",
      at: [100, 500],
    },
  ],
};

describe("Island Art metadata validator", () => {
  it("passes completely on valid IslandArt metadata", () => {
    const errors = validateIslandArt(SAMPLE_VALID_ART);
    expect(errors).toEqual([]);
  });

  it("rejects non-object or wrong version", () => {
    expect(validateIslandArt(null)).toContain(
      "Island art metadata must be a JSON object"
    );
    expect(validateIslandArt("invalid")).toContain(
      "Island art metadata must be a JSON object"
    );
    expect(
      validateIslandArt({ ...SAMPLE_VALID_ART, version: 2 as unknown as 1 })
    ).toContain("Invalid version: expected 1, found 2");
  });

  it("rejects invalid dimensions", () => {
    const errors = validateIslandArt({
      ...SAMPLE_VALID_ART,
      size: { w: -10, h: 0 },
    });
    expect(errors.some((e) => e.includes("Invalid width"))).toBe(true);
    expect(errors.some((e) => e.includes("Invalid height"))).toBe(true);
  });

  it("enforces closed polygons (first point === last point)", () => {
    const unclosedArt = {
      ...SAMPLE_VALID_ART,
      walkable: [
        [
          [100, 200],
          [700, 200],
          [700, 800],
          [100, 800], // missing closing [100, 200]
        ],
      ],
    };
    const errors = validateIslandArt(unclosedArt);
    expect(errors.some((e) => e.includes("is not closed"))).toBe(true);
  });

  it("enforces polygons inside island boundaries", () => {
    const outOfBoundsArt = {
      ...SAMPLE_VALID_ART,
      walkable: [
        [
          [100, 200],
          [900, 200], // 900 > w (800)
          [900, 800],
          [100, 800],
          [100, 200],
        ],
      ],
    };
    const errors = validateIslandArt(outOfBoundsArt);
    expect(errors.some((e) => e.includes("is outside island size"))).toBe(true);
  });

  it("enforces buildingIds in doors exist in world.ts", () => {
    const invalidDoorArt = {
      ...SAMPLE_VALID_ART,
      doors: [
        {
          buildingId: "nonexistent_building_xyz",
          at: [200, 350] as [number, number],
          radius: 20,
        },
      ],
    };
    const errors = validateIslandArt(invalidDoorArt);
    expect(
      errors.some((e) =>
        e.includes('unknown buildingId: "nonexistent_building_xyz"')
      )
    ).toBe(true);
  });

  it("enforces unique anchor IDs", () => {
    const duplicateAnchorArt = {
      ...SAMPLE_VALID_ART,
      anchors: [
        { id: "to_khidmty", at: [400, 100] as [number, number] },
        { id: "to_khidmty", at: [100, 500] as [number, number] },
      ],
    };
    const errors = validateIslandArt(duplicateAnchorArt);
    expect(
      errors.some((e) => e.includes('Duplicate anchor id: "to_khidmty"'))
    ).toBe(true);
  });

  it("enforces unique occluder IDs and valid rect bounds", () => {
    const invalidOccluderArt = {
      ...SAMPLE_VALID_ART,
      occluders: [
        {
          id: "roof1",
          rect: [10, 10, 20, 20] as [number, number, number, number],
          baseY: 30,
        },
        {
          id: "roof1",
          rect: [700, 900, 200, 200] as [number, number, number, number],
          baseY: 950,
        },
      ],
    };
    const errors = validateIslandArt(invalidOccluderArt);
    expect(
      errors.some((e) => e.includes('Duplicate occluder id: "roof1"'))
    ).toBe(true);
    expect(errors.some((e) => e.includes("exceeds island bounds"))).toBe(true);
  });
});

describe("Island Art processing pipeline", () => {
  it("processes synthetic pixel art fixture end to end (scale 4, binary alpha, size match, colors <= 64)", async () => {
    const nativeW = 120;
    const nativeH = 80;
    const scale = 4;
    const upW = nativeW * scale;
    const upH = nativeH * scale;

    // Generate synthetic 120x80 pixel art buffer with magenta margins
    const nativeBuf = Buffer.alloc(nativeW * nativeH * 4);
    for (let y = 0; y < nativeH; y++) {
      for (let x = 0; x < nativeW; x++) {
        const idx = (y * nativeW + x) * 4;
        if (x < 10 || x >= 110 || y < 10 || y >= 70) {
          // Flat magenta background
          nativeBuf[idx] = 255;
          nativeBuf[idx + 1] = 0;
          nativeBuf[idx + 2] = 255;
          nativeBuf[idx + 3] = 255;
        } else {
          // Crisp patterned pixel art features
          const val = ((x % 3) * 60 + (y % 4) * 50) % 255;
          nativeBuf[idx] = val;
          nativeBuf[idx + 1] = (val + 50) % 255;
          nativeBuf[idx + 2] = (val + 100) % 255;
          nativeBuf[idx + 3] = 255;
        }
      }
    }

    // Upscale 4x with nearest-neighbour and add slight JPEG compression noise
    const jpegBuf = await sharp(nativeBuf, {
      raw: { width: nativeW, height: nativeH, channels: 4 },
    })
      .resize(upW, upH, { kernel: sharp.kernel.nearest })
      .jpeg({ quality: 95 })
      .toBuffer();

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "island-test-"));

    try {
      const result = await processIsland({
        islandId: "test_island",
        src: jpegBuf,
        outputDir: tempDir,
        reportScale: true,
      });

      // 1. Asserts that it detects scale 4
      expect(result.appliedScale).toBe(4);

      // 2. Asserts size matches (trimmed: 120x80 minus 10px magenta margins = 100x60)
      expect(result.finalSize.w).toBe(100);
      expect(result.finalSize.h).toBe(60);

      // 3. Asserts alpha is strictly binary (0 or 255)
      const webpRaw = await sharp(result.webpPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      for (let i = 3; i < webpRaw.data.length; i += 4) {
        const a = webpRaw.data[i];
        expect(a === 0 || a === 255).toBe(true);
      }

      // 4. Asserts color count is under 64
      expect(result.colorCount).toBeLessThanOrEqual(64);

      // 5. Asserts starter island.json was created and passes validateIslandArt
      expect(result.jsonCreated).toBe(true);
      const jsonContent = JSON.parse(
        await fs.readFile(result.jsonPath, "utf-8")
      );
      const jsonErrors = validateIslandArt(jsonContent);
      expect(jsonErrors).toEqual([]);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("processes synthetic fixture with explicit --width", async () => {
    const rawBuf = Buffer.alloc(100 * 100 * 4);
    for (let i = 0; i < rawBuf.length; i += 4) {
      if (i < 5000) {
        rawBuf[i] = 255;
        rawBuf[i + 1] = 0;
        rawBuf[i + 2] = 255;
        rawBuf[i + 3] = 255; // magenta
      } else {
        rawBuf[i] = 100;
        rawBuf[i + 1] = 150;
        rawBuf[i + 2] = 200;
        rawBuf[i + 3] = 255; // feature
      }
    }

    const png = await sharp(rawBuf, {
      raw: { width: 100, height: 100, channels: 4 },
    })
      .png()
      .toBuffer();

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "island-width-"));
    try {
      const result = await processIsland({
        islandId: "test_width",
        src: png,
        width: 50,
        outputDir: tempDir,
      });

      expect(result.scaleMode).toContain("explicit width (50px)");
      expect(result.colorCount).toBeLessThanOrEqual(64);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("validates existing public/game/islands/home/island.json metadata", async () => {
    const jsonPath = path.join(
      process.cwd(),
      "public",
      "game",
      "islands",
      "home",
      "island.json"
    );
    const content = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
    const errors = validateIslandArt(content);
    expect(errors).toEqual([]);
  });
});
