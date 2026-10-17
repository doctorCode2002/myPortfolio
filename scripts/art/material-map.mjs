#!/usr/bin/env node
/**
 * Living World Material Map Generator CLI.
 *
 * Implements material map generation per `docs/LIVING_WORLD_SPEC.md`:
 * - Preferred: `npm run art:material -- <islandId> --seg <segmentation-image>`
 * - Fallback: `npm run art:material -- <islandId> --auto`
 *
 * Snaps to exact material palette, removes noisy specks (<6px),
 * outputs `public/game/islands/<id>/material.png` matching `island.webp` size,
 * and generates a debug overlay preview.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import {
  generateAutoMaterial,
  generateDebugOverlay,
  removeSpecks,
  snapBufferToPalette,
} from "./material-utils.mjs";

const DEFAULT_SCRATCH_DIR =
  "/home/mohammed/.gemini/antigravity-cli/brain/7f15719d-9fc8-46ff-aa99-3dbc6411a91c/scratch";

export async function processMaterialMap(options) {
  const {
    islandId,
    segFile,
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
    // 2a. Segmentation image mode
    const segRaw = await sharp(segFile)
      .resize(width, height, { kernel: sharp.kernel.nearest })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Snap to nearest palette and clean specks
    const snapped = snapBufferToPalette(segRaw.data, width, height, 3);
    materialRgb = removeSpecks(snapped, width, height, 6);
  } else if (auto) {
    // 2b. Auto heuristic mode
    materialRgb = generateAutoMaterial(islandRgba, width, height, {
      minSpeckSize: 6,
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

  // 4. Generate debug overlay preview (50% blended on art)
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

  await sharp(overlayRgba, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(debugPreviewPath);

  return {
    islandId,
    width,
    height,
    materialPngPath,
    debugPreviewPath,
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
  let auto = false;
  let previewPath = null;
  let outputDir = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--seg" && i + 1 < args.length) {
      segFile = args[++i];
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
      "Usage: npm run art:material -- <islandId> (--seg <file> | --auto) [--preview <path>]"
    );
    process.exit(1);
  }

  const islandId = positionals[0];

  try {
    const res = await processMaterialMap({
      islandId,
      segFile,
      auto,
      previewPath,
      outputDir,
    });

    console.log(`✓ Generated material map for island "${res.islandId}":`);
    console.log(`  - Dimensions: ${res.width}x${res.height}`);
    console.log(`  - Output: ${res.materialPngPath}`);
    console.log(`  - Debug Preview: ${res.debugPreviewPath}`);
  } catch (err) {
    console.error("Error generating material map:", err);
    process.exit(1);
  }
}
