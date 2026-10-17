#!/usr/bin/env node
/**
 * Living World Material Map Generator CLI.
 *
 * Implements material map generation per `docs/LIVING_WORLD_SPEC.md`:
 * - Preferred: `npm run art:material -- <islandId> --seg <segmentation-image> [--art <art-image>]`
 * - Fallback: `npm run art:material -- <islandId> --auto`
 *
 * Snaps to exact material palette, fills black outline strokes and fringes,
 * removes obstacle snags on roads (<=12px), cleans specks (<6px),
 * outputs `public/game/islands/<id>/material.png` matching `island.webp` size,
 * and generates 1x native and 3x nearest-upscaled debug overlays.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { chromaKeyAndDespill } from "./process-island.mjs";
import {
  computeClassHistogram,
  generateAutoMaterial,
  generateDebugOverlay,
  processSegmentationMap,
} from "./material-utils.mjs";

const DEFAULT_SCRATCH_DIR =
  "/home/mohammed/.gemini/antigravity-cli/brain/7f15719d-9fc8-46ff-aa99-3dbc6411a91c/scratch";

export async function processMaterialMap(options) {
  const {
    islandId,
    segFile,
    artFile,
    auto = false,
    outputDir,
    previewPath,
    scratchDir = DEFAULT_SCRATCH_DIR,
  } = options;

  const islandDir =
    outputDir ??
    path.join(process.cwd(), "public", "game", "islands", islandId);
  const webpPath = path.join(islandDir, "island.webp");
  const materialPngPath = path.join(islandDir, "material.png");

  // 1. Read base island.webp
  const webpBuffer = await fs.readFile(webpPath);
  const { data: islandRgba, info: webpInfo } = await sharp(webpBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = webpInfo;
  let materialRgb;

  if (segFile) {
    // Check if segFile dimensions match island.webp directly or if it's a full-size raw canvas
    const segMeta = await sharp(segFile).metadata();
    let mapExtractBuffer;

    if (segMeta.width === width && segMeta.height === height) {
      const segRaw = await sharp(segFile)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      mapExtractBuffer = segRaw.data;
    } else {
      // Find matching raw art if available to compute exact trim box
      let rawArtPath = artFile;
      if (!rawArtPath) {
        // Try known download paths
        const candidates = [
          path.join("/home/mohammed/Downloads/islands", `${islandId}.jpeg`),
          path.join("/home/mohammed/Downloads/islands", `${islandId}.jpg`),
          path.join(
            "/home/mohammed/Downloads/islands",
            `${islandId.charAt(0).toUpperCase() + islandId.slice(1)}.jpeg`
          ),
          path.join(
            "/home/mohammed/Downloads/islands",
            `${islandId.toUpperCase()}.jpeg`
          ),
        ];
        if (islandId === "civicmind") {
          candidates.unshift("/home/mohammed/Downloads/islands/civicMind.jpeg");
        }
        for (const cand of candidates) {
          try {
            await fs.access(cand);
            rawArtPath = cand;
            break;
          } catch {}
        }
      }

      if (rawArtPath) {
        // Use exact art trim box
        const artBuf = await sharp(rawArtPath)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const origW = artBuf.info.width;
        const origH = artBuf.info.height;
        const keyed = chromaKeyAndDespill(artBuf.data, 18);
        const targetW = islandId === "home" ? 896 : 566;
        const targetH = Math.round((origH * targetW) / origW);

        const downscaledArt = await sharp(keyed, {
          raw: { width: origW, height: origH, channels: 4 },
        })
          .resize(targetW, targetH, { kernel: sharp.kernel.mitchell })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const dData = downscaledArt.data;
        for (let i = 3; i < dData.length; i += 4) {
          dData[i] = dData[i] < 128 ? 0 : 255;
        }

        let minX = targetW,
          maxX = 0,
          minY = targetH,
          maxY = 0;
        for (let y = 0; y < targetH; y++) {
          for (let x = 0; x < targetW; x++) {
            if (dData[(y * targetW + x) * 4 + 3] === 255) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        const mapTrimmed = await sharp(segFile)
          .resize(targetW, targetH, { kernel: sharp.kernel.nearest })
          .extract({ left: minX, top: minY, width, height })
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        mapExtractBuffer = mapTrimmed.data;
      } else {
        // Fallback: nearest resize to width x height
        const mapResized = await sharp(segFile)
          .resize(width, height, { kernel: sharp.kernel.nearest })
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        mapExtractBuffer = mapResized.data;
      }
    }

    // Process segmentation map
    materialRgb = processSegmentationMap(
      mapExtractBuffer,
      width,
      height,
      islandRgba,
      {
        maxSnagSize: 12,
        minSpeckSize: 6,
      }
    );
  } else if (auto) {
    // 2b. Auto heuristic mode (fallback)
    materialRgb = generateAutoMaterial(islandRgba, width, height, {
      minSpeckSize: 6,
      cliffBand: 4,
    });
  } else {
    throw new Error("Must specify either --seg <file> or --auto");
  }

  // 3. Write material.png (lossless PNG matching exact dimensions)
  await fs.mkdir(islandDir, { recursive: true });
  await sharp(materialRgb, {
    raw: { width, height, channels: 3 },
  })
    .png({ compressionLevel: 9 })
    .toFile(materialPngPath);

  // 4. Generate debug overlays (50% blended on art: 1x native and 3x nearest-upscaled)
  const overlayRgba = generateDebugOverlay(
    islandRgba,
    materialRgb,
    width,
    height,
    0.5
  );

  await fs.mkdir(scratchDir, { recursive: true });
  const debugPreviewPath =
    previewPath ?? path.join(scratchDir, `material_overlay_${islandId}.png`);
  const debugPreview3xPath = path.join(
    scratchDir,
    `material_overlay_${islandId}_3x.png`
  );

  await sharp(overlayRgba, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(debugPreviewPath);

  await sharp(overlayRgba, {
    raw: { width, height, channels: 4 },
  })
    .resize(width * 3, height * 3, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(debugPreview3xPath);

  // 5. Compute class histogram
  const histogram = computeClassHistogram(materialRgb, width, height);

  return {
    islandId,
    width,
    height,
    materialPngPath,
    debugPreviewPath,
    debugPreview3xPath,
    histogram,
  };
}

// CLI entry point
if (
  process.argv[1] &&
  import.meta.url.endsWith(path.basename(process.argv[1]))
) {
  const args = process.argv.slice(2);
  const positionals = [];
  let segFile = null;
  let artFile = null;
  let auto = false;
  let previewPath = null;
  let outputDir = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--seg" && i + 1 < args.length) {
      segFile = args[++i];
    } else if (arg === "--art" && i + 1 < args.length) {
      artFile = args[++i];
    } else if (arg === "--auto") {
      auto = true;
    } else if (arg === "--preview" && i + 1 < args.length) {
      previewPath = args[++i];
    } else if (arg === "--output-dir" && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  if (positionals.length < 1 || (!auto && !segFile)) {
    console.error(
      "Usage: npm run art:material -- <islandId> (--seg <file> | --auto) [--art <artFile>] [--preview <path>]"
    );
    process.exit(1);
  }

  const islandId = positionals[0];

  try {
    const res = await processMaterialMap({
      islandId,
      segFile,
      artFile,
      auto,
      previewPath,
      outputDir,
    });

    console.log(`✓ Generated material map for island "${res.islandId}":`);
    console.log(`  - Dimensions: ${res.width}x${res.height}`);
    console.log(`  - Output: ${res.materialPngPath}`);
    console.log(`  - Debug Preview (1x): ${res.debugPreviewPath}`);
    console.log(`  - Debug Preview (3x): ${res.debugPreview3xPath}`);
    console.log("  - Class Histogram:");
    for (const [name, stats] of Object.entries(res.histogram)) {
      console.log(
        `      ${name.padEnd(8)}: ${String(stats.count).padStart(7)} px (${stats.percentStr})`
      );
    }
  } catch (err) {
    console.error("Error generating material map:", err);
    process.exit(1);
  }
}
