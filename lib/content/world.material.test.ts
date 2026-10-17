import { describe, expect, it } from "vitest";
import {
  generateAutoMaterial,
  MATERIAL_PALETTE,
  removeSpecks,
  snapBufferToPalette,
  snapToNearestPalette,
} from "../../scripts/art/material-utils.mjs";

describe("Living World material map utilities", () => {
  describe("Palette snapping", () => {
    it("snaps exact palette colors to themselves", () => {
      for (const [name, rgb] of Object.entries(MATERIAL_PALETTE)) {
        const snapped = snapToNearestPalette(rgb[0], rgb[1], rgb[2]);
        expect(snapped.name).toBe(name);
        expect(snapped.rgb).toEqual(rgb);
      }
    });

    it("snaps noisy RGB values to the nearest semantic material class", () => {
      // Off-white / light stone path -> road
      expect(snapToNearestPalette(240, 248, 252).name).toBe("road");

      // Bright lush green -> grass
      expect(snapToNearestPalette(12, 195, 18).name).toBe("grass");

      // Deep forest green -> canopy
      expect(snapToNearestPalette(8, 76, 12).name).toBe("canopy");

      // Saturated azure blue -> water
      expect(snapToNearestPalette(10, 15, 235).name).toBe("water");

      // Earthy rock brown -> cliff
      expect(snapToNearestPalette(125, 68, 8).name).toBe("cliff");

      // Warm scarlet / brick -> solid
      expect(snapToNearestPalette(240, 15, 10).name).toBe("solid");

      // Bright magenta background key -> void
      expect(snapToNearestPalette(250, 8, 248).name).toBe("void");
    });

    it("snaps a whole image buffer to valid palette colors only", () => {
      const width = 4;
      const height = 4;
      const noisyBuffer = Buffer.alloc(width * height * 3);

      for (let i = 0; i < width * height * 3; i++) {
        noisyBuffer[i] = (i * 37) % 256;
      }

      const snapped = snapBufferToPalette(noisyBuffer, width, height, 3);
      const validPaletteSet = new Set(
        Object.values(MATERIAL_PALETTE).map((rgb) => {
          const [r, g, b] = rgb as [number, number, number];
          return (r << 16) | (g << 8) | b;
        })
      );

      for (let i = 0; i < width * height; i++) {
        const r = snapped[i * 3]!;
        const g = snapped[i * 3 + 1]!;
        const b = snapped[i * 3 + 2]!;
        const rgb = (r << 16) | (g << 8) | b;
        expect(validPaletteSet.has(rgb)).toBe(true);
      }
    });
  });

  describe("Morphological cleanup (speck removal)", () => {
    it("removes isolated 1-pixel specks and merges them into the dominant neighbor", () => {
      const w = 5;
      const h = 5;
      const buf = Buffer.alloc(w * h * 3);

      // Fill background with grass [0, 200, 0]
      for (let i = 0; i < w * h; i++) {
        buf[i * 3] = 0;
        buf[i * 3 + 1] = 200;
        buf[i * 3 + 2] = 0;
      }

      // Add a single-pixel solid speck at center (2, 2)
      const center = (2 * w + 2) * 3;
      buf[center] = 255;
      buf[center + 1] = 0;
      buf[center + 2] = 0;

      const cleaned = removeSpecks(buf, w, h, 6);

      // Center should have been cleaned to grass
      expect(cleaned[center]).toBe(0);
      expect(cleaned[center + 1]).toBe(200);
      expect(cleaned[center + 2]).toBe(0);
    });

    it("removes small clusters under 6 pixels and preserves clusters >= 6 pixels", () => {
      const w = 10;
      const h = 10;
      const buf = Buffer.alloc(w * h * 3);

      // Background: road [255, 255, 255]
      buf.fill(255);

      // Small cluster: 3 pixels of solid [255, 0, 0] at (1, 1), (1, 2), (1, 3)
      for (const y of [1, 2, 3]) {
        const idx = (y * w + 1) * 3;
        buf[idx] = 255;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
      }

      // Large cluster: 8 pixels (2x4) of solid [255, 0, 0] at x in [5, 6], y in [5, 8]
      for (let y = 5; y <= 8; y++) {
        for (let x = 5; x <= 6; x++) {
          const idx = (y * w + x) * 3;
          buf[idx] = 255;
          buf[idx + 1] = 0;
          buf[idx + 2] = 0;
        }
      }

      const cleaned = removeSpecks(buf, w, h, 6);

      // Small 3-pixel cluster should be eliminated to road (255, 255, 255)
      for (const y of [1, 2, 3]) {
        const idx = (y * w + 1) * 3;
        expect(cleaned[idx + 1]).toBe(255);
      }

      // Large 8-pixel cluster must be preserved as solid (255, 0, 0)
      for (let y = 5; y <= 8; y++) {
        for (let x = 5; x <= 6; x++) {
          const idx = (y * w + x) * 3;
          expect(cleaned[idx]).toBe(255);
          expect(cleaned[idx + 1]).toBe(0);
          expect(cleaned[idx + 2]).toBe(0);
        }
      }
    });
  });

  describe("Auto material classification heuristic", () => {
    it("classifies synthetic pixel zones into appropriate material classes", () => {
      const w = 30;
      const h = 30;
      const rgba = Buffer.alloc(w * h * 4);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i4 = (y * w + x) * 4;

          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
            // Transparent border -> void
            rgba[i4 + 3] = 0;
          } else if (x < 10 && y < 10) {
            // Vibrant green -> grass
            rgba[i4] = 40;
            rgba[i4 + 1] = 190;
            rgba[i4 + 2] = 40;
            rgba[i4 + 3] = 255;
          } else if (x > 18 && y > 18) {
            // Deep blue waterfall / pool -> water
            rgba[i4] = 20;
            rgba[i4 + 1] = 80;
            rgba[i4 + 2] = 210;
            rgba[i4 + 3] = 255;
          } else if (x >= 10 && x <= 18 && y < 15) {
            // Light tan cobblestone path -> road
            rgba[i4] = 210;
            rgba[i4 + 1] = 195;
            rgba[i4 + 2] = 175;
            rgba[i4 + 3] = 255;
          } else {
            // Building wall / solid
            rgba[i4] = 130;
            rgba[i4 + 1] = 70;
            rgba[i4 + 2] = 50;
            rgba[i4 + 3] = 255;
          }
        }
      }

      const mat = generateAutoMaterial(rgba, w, h, { minSpeckSize: 4 });

      // Check transparent pixel is void [255, 0, 255]
      expect(mat[0]).toBe(255);
      expect(mat[1]).toBe(0);
      expect(mat[2]).toBe(255);

      // Check grass zone pixel at (5, 5) is grass [0, 200, 0]
      const grassIdx = (5 * w + 5) * 3;
      expect(mat[grassIdx]).toBe(0);
      expect(mat[grassIdx + 1]).toBe(200);
      expect(mat[grassIdx + 2]).toBe(0);

      // Check water zone pixel at (24, 24) is water [0, 0, 255]
      const waterIdx = (24 * w + 24) * 3;
      expect(mat[waterIdx]).toBe(0);
      expect(mat[waterIdx + 1]).toBe(0);
      expect(mat[waterIdx + 2]).toBe(255);

      // Check road zone pixel at (14, 8) is road [255, 255, 255]
      const roadIdx = (8 * w + 14) * 3;
      expect(mat[roadIdx]).toBe(255);
      expect(mat[roadIdx + 1]).toBe(255);
      expect(mat[roadIdx + 2]).toBe(255);
    });
  });

  describe("Segmentation map processing & class preservation", () => {
    it("preserves all 10 material classes in a synthetic map with black outlines", async () => {
      const { processSegmentationMap, computeClassHistogram } =
        await import("../../scripts/art/material-utils.mjs");

      // Create a 10x10 grid of blocks (width = 100, height = 40)
      // 10 classes arranged horizontally in 10x40 patches, separated by 2px black outlines
      const w = 120;
      const h = 40;
      const mapRgb = Buffer.alloc(w * h * 3);
      const artAlpha = Buffer.alloc(w * h * 4);
      artAlpha.fill(255);

      const classEntries = Object.entries(MATERIAL_PALETTE);
      expect(classEntries.length).toBe(10);

      // Fill blocks
      for (let c = 0; c < 10; c++) {
        const entry = classEntries[c]!;
        const rgb = entry[1];
        const startX = c * 12;
        for (let y = 0; y < h; y++) {
          for (let x = startX; x < startX + 10; x++) {
            const idx = (y * w + x) * 3;
            mapRgb[idx] = rgb[0]!;
            mapRgb[idx + 1] = rgb[1]!;
            mapRgb[idx + 2] = rgb[2]!;
          }
          // 2px black outline between blocks
          for (let x = startX + 10; x < startX + 12; x++) {
            const idx = (y * w + x) * 3;
            mapRgb[idx] = 10; // black outline
            mapRgb[idx + 1] = 10;
            mapRgb[idx + 2] = 10;
          }
        }
      }

      const processed = (
        processSegmentationMap as (
          map: Buffer,
          w: number,
          h: number,
          alpha: Buffer | null,
          opts?: Record<string, unknown>
        ) => Buffer
      )(mapRgb, w, h, artAlpha, {
        maxSnagSize: 0,
        minSpeckSize: 2,
      });

      const hist = (
        computeClassHistogram as (
          mat: Buffer,
          w: number,
          h: number
        ) => Record<string, { count: number }>
      )(processed, w, h);

      // Assert that every single one of the 10 classes is retained
      for (const [className] of classEntries) {
        expect(hist[className]!.count).toBeGreaterThan(0);
      }
    });

    it("removes small solid snags on road and preserves larger solid obstacles", async () => {
      const { removeRoadSnags, packRgb } =
        await import("../../scripts/art/material-utils.mjs");

      const w = 20;
      const h = 20;
      const ROAD = packRgb(...MATERIAL_PALETTE.road);
      const SOLID = packRgb(...MATERIAL_PALETTE.solid);

      const colorArray = new Uint32Array(w * h);
      colorArray.fill(ROAD);

      // Add a small 4-pixel solid snag (2x2) at (3, 3)
      for (const y of [3, 4]) {
        for (const x of [3, 4]) {
          colorArray[y * w + x] = SOLID;
        }
      }

      // Add a large 25-pixel solid building (5x5) at (10, 10)
      for (let y = 10; y < 15; y++) {
        for (let x = 10; x < 15; x++) {
          colorArray[y * w + x] = SOLID;
        }
      }

      removeRoadSnags(colorArray, w, h, 12);

      // Small 4px snag should have been eliminated to road
      expect(colorArray[3 * w + 3]).toBe(ROAD);
      expect(colorArray[4 * w + 4]).toBe(ROAD);

      // Large 25px building obstacle must remain solid
      expect(colorArray[12 * w + 12]).toBe(SOLID);
    });
  });
});
