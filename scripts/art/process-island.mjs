#!/usr/bin/env node
/**
 * Illustrated Island Art Processing Pipeline.
 *
 * Implements the art processing steps from `docs/ISLAND_ART_SPEC.md`:
 * 1. Magenta chroma-key with binary alpha (0 or 255) and edge despill.
 * 2. Downscale via explicit `--width <px>` (primary AI-art flow) or auto-scale detection (2-8x nearest-neighbour).
 * 3. Color quantization to <= 64 colours without dithering (clean median-cut pixel palette).
 * 4. Transparent margin trimming and lossless WebP output.
 * 5. Generation of starter `island.json` if missing.
 *
 * Usage:
 *   npm run art:island -- <islandId> <src> [--width <px>] [--scale <N>] [--fuzz <percent>] [--report-scale]
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

/**
 * Chroma-keys solid magenta (#FF00FF) with fuzz tolerance to alpha 0 or 255.
 * On kept pixels, applies despill to pull red/blue toward green when magenta fringe is detected.
 */
export function chromaKeyAndDespill(rawBuffer, fuzzPercent = 18) {
  const fuzzDistance = (fuzzPercent / 100) * 441.67;
  const out = Buffer.from(rawBuffer);

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];

    // Distance to pure magenta (255, 0, 255) in RGB Euclidean space
    const dist = Math.hypot(r - 255, g - 0, b - 255);

    if (dist <= fuzzDistance) {
      out[i + 3] = 0; // Fully transparent
    } else {
      out[i + 3] = 255; // Fully opaque (binary alpha)

      // Despill: remove pink/magenta fringe (where both R and B exceed G)
      if (r > g && b > g) {
        const excess = Math.min(r - g, b - g);
        out[i] = Math.max(0, r - excess);
        out[i + 2] = Math.max(0, b - excess);
      }
    }
  }

  return out;
}

/**
 * Detects the integer pixel-scale factor (2x to 8x) for true pixel art grids.
 * Analyzes boundary transitions versus internal block variance across non-transparent pixels.
 */
export function detectPixelScale(rawBuffer, width, height) {
  let bestScale = 1;
  let bestRatio = 0;

  for (let s = 8; s >= 2; s--) {
    let intDiff = 0,
      intCount = 0;
    let bndDiff = 0,
      bndCount = 0;

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width - 1; x++) {
        const i1 = (y * width + x) * 4;
        const i2 = (y * width + (x + 1)) * 4;
        if (rawBuffer[i1 + 3] === 0 && rawBuffer[i2 + 3] === 0) continue;

        const diff =
          Math.abs(rawBuffer[i1] - rawBuffer[i2]) +
          Math.abs(rawBuffer[i1 + 1] - rawBuffer[i2 + 1]) +
          Math.abs(rawBuffer[i1 + 2] - rawBuffer[i2 + 2]);

        if ((x + 1) % s === 0) {
          bndDiff += diff;
          bndCount++;
        } else {
          intDiff += diff;
          intCount++;
        }
      }
    }

    if (intCount > 0 && bndCount > 0) {
      const avgInt = intDiff / intCount;
      const avgBnd = bndDiff / bndCount;
      const ratio = avgBnd / (avgInt + 0.001);

      if (ratio > bestRatio && ratio >= 2.0 && avgInt < 40) {
        bestRatio = ratio;
        bestScale = s;
      }
    }
  }

  return bestScale;
}

/**
 * Quantizes colors in a raw RGBA buffer to at most `maxColors` using median-cut,
 * preserving transparent pixels.
 */
export function quantizeToMaxColors(rawBuffer, maxColors = 64) {
  const colorMap = new Map();
  for (let i = 0; i < rawBuffer.length; i += 4) {
    if (rawBuffer[i + 3] === 0) continue;
    const rgb =
      (rawBuffer[i] << 16) | (rawBuffer[i + 1] << 8) | rawBuffer[i + 2];
    colorMap.set(rgb, (colorMap.get(rgb) || 0) + 1);
  }

  // Budget for opaque colors (reserving 1 palette slot for transparency)
  const targetOpaque = maxColors - 1;
  if (colorMap.size <= targetOpaque) return rawBuffer;

  const items = Array.from(colorMap.entries()).map(([rgb, count]) => ({
    r: (rgb >> 16) & 0xff,
    g: (rgb >> 8) & 0xff,
    b: rgb & 0xff,
    count,
    rgb,
  }));

  const boxes = [items];
  while (boxes.length < targetOpaque) {
    let bestBoxIdx = -1;
    let maxRange = -1;
    let bestChannel = "r";

    for (let b = 0; b < boxes.length; b++) {
      const box = boxes[b];
      if (box.length <= 1) continue;

      let minR = 255,
        maxR = 0,
        minG = 255,
        maxG = 0,
        minB = 255,
        maxB = 0;
      for (const item of box) {
        if (item.r < minR) minR = item.r;
        if (item.r > maxR) maxR = item.r;
        if (item.g < minG) minG = item.g;
        if (item.g > maxG) maxG = item.g;
        if (item.b < minB) minB = item.b;
        if (item.b > maxB) maxB = item.b;
      }
      const rangeR = maxR - minR;
      const rangeG = maxG - minG;
      const rangeB = maxB - minB;
      const range = Math.max(rangeR, rangeG, rangeB);

      if (range > maxRange) {
        maxRange = range;
        bestBoxIdx = b;
        bestChannel =
          rangeR >= rangeG && rangeR >= rangeB
            ? "r"
            : rangeG >= rangeB
              ? "g"
              : "b";
      }
    }

    if (bestBoxIdx === -1 || maxRange <= 0) break;

    const boxToSplit = boxes.splice(bestBoxIdx, 1)[0];
    boxToSplit.sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = Math.floor(boxToSplit.length / 2);
    boxes.push(boxToSplit.slice(0, mid));
    boxes.push(boxToSplit.slice(mid));
  }

  const lookup = new Map();
  for (const box of boxes) {
    let sumR = 0,
      sumG = 0,
      sumB = 0,
      total = 0;
    for (const item of box) {
      sumR += item.r * item.count;
      sumG += item.g * item.count;
      sumB += item.b * item.count;
      total += item.count;
    }
    const avgR = Math.round(sumR / total);
    const avgG = Math.round(sumG / total);
    const avgB = Math.round(sumB / total);
    for (const item of box) {
      lookup.set(item.rgb, [avgR, avgG, avgB]);
    }
  }

  const out = Buffer.from(rawBuffer);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const rgb = (out[i] << 16) | (out[i + 1] << 8) | out[i + 2];
    const mapped = lookup.get(rgb);
    if (mapped) {
      out[i] = mapped[0];
      out[i + 1] = mapped[1];
      out[i + 2] = mapped[2];
    }
  }
  return out;
}

/**
 * Counts unique colors in a raw/WebP buffer (transparent counts as 1 color).
 */
export async function countUniqueColors(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colors = new Set();
  for (let i = 0; i < data.length; i += info.channels) {
    if (info.channels === 4 && data[i + 3] === 0) {
      colors.add(0);
    } else {
      const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      colors.add(rgb);
    }
  }
  return colors.size;
}

/**
 * Processes a single island source image through the art pipeline.
 */
export async function processIsland(options) {
  const {
    islandId,
    src,
    width: targetWidth,
    scale: explicitScale,
    fuzz: fuzzPercent = 18,
    outputDir,
    reportScale = false,
  } = options;

  // 1. Read input image and obtain raw pixels
  const inputBuffer = Buffer.isBuffer(src) ? src : await fs.readFile(src);
  const metadata = await sharp(inputBuffer).metadata();
  const origW = metadata.width;
  const origH = metadata.height;

  const { data: rawData } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 2. Chroma key magenta and despill
  const keyedBuffer = chromaKeyAndDespill(rawData, fuzzPercent);

  // 3. Determine downscale mode
  let downscaledWidth, downscaledHeight, resizeKernel;
  let appliedScale = 1;
  let scaleMode = "none";

  if (targetWidth) {
    scaleMode = `explicit width (${targetWidth}px)`;
    appliedScale = origW / targetWidth;
    downscaledWidth = targetWidth;
    downscaledHeight = Math.round((origH * targetWidth) / origW);
    resizeKernel = sharp.kernel.mitchell;
  } else if (explicitScale) {
    appliedScale = explicitScale;
    scaleMode = `explicit scale (${explicitScale}x)`;
    downscaledWidth = Math.round(origW / explicitScale);
    downscaledHeight = Math.round(origH / explicitScale);
    resizeKernel = sharp.kernel.nearest;
  } else {
    const detected = detectPixelScale(keyedBuffer, origW, origH);
    appliedScale = detected;
    scaleMode =
      detected > 1 ? `auto-detected scale (${detected}x)` : "1:1 native";
    downscaledWidth = Math.round(origW / detected);
    downscaledHeight = Math.round(origH / detected);
    resizeKernel = sharp.kernel.nearest;
  }

  // 4. Downscale and get raw RGBA
  const { data: downscaledData, info: dInfo } = await sharp(keyedBuffer, {
    raw: { width: origW, height: origH, channels: 4 },
  })
    .resize(downscaledWidth, downscaledHeight, { kernel: resizeKernel })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 5. Binary alpha thresholding at 50%
  for (let i = 3; i < downscaledData.length; i += 4) {
    downscaledData[i] = downscaledData[i] < 128 ? 0 : 255;
  }

  // 6. Color quantization to <= 64 colours max without dithering
  const quantizedData = quantizeToMaxColors(downscaledData, 64);

  // 7. Trim transparent margins and write lossless WebP
  const trimmed = await sharp(quantizedData, {
    raw: { width: dInfo.width, height: dInfo.height, channels: 4 },
  })
    .trim()
    .webp({ lossless: true })
    .toBuffer({ resolveWithObject: true });

  const webpBuffer = trimmed.data;
  const finalW = trimmed.info.width;
  const finalH = trimmed.info.height;
  const colorCount = await countUniqueColors(webpBuffer);

  // 8. Output paths and writing
  const destDir =
    outputDir ??
    path.join(process.cwd(), "public", "game", "islands", islandId);
  await fs.mkdir(destDir, { recursive: true });

  const webpPath = path.join(destDir, "island.webp");
  const jsonPath = path.join(destDir, "island.json");

  await fs.writeFile(webpPath, webpBuffer);

  // 9. Starter island.json if missing
  let jsonCreated = false;
  try {
    await fs.access(jsonPath);
  } catch {
    const starterJson = {
      version: 1,
      size: { w: finalW, h: finalH },
      walkable: [
        [
          [Math.round(finalW * 0.15), Math.round(finalH * 0.25)],
          [Math.round(finalW * 0.85), Math.round(finalH * 0.25)],
          [Math.round(finalW * 0.85), Math.round(finalH * 0.65)],
          [Math.round(finalW * 0.15), Math.round(finalH * 0.65)],
          [Math.round(finalW * 0.15), Math.round(finalH * 0.25)],
        ],
      ],
      blockers: [],
      occluders: [],
      doors: [],
      spawns: {
        player: [Math.round(finalW / 2), Math.round(finalH * 0.45)],
      },
      anchors: [],
    };
    await fs.writeFile(jsonPath, JSON.stringify(starterJson, null, 2) + "\n");
    jsonCreated = true;
  }

  const result = {
    islandId,
    originalSize: { w: origW, h: origH },
    finalSize: { w: finalW, h: finalH },
    scaleMode,
    appliedScale,
    colorCount,
    fileSizeBytes: webpBuffer.length,
    fileSizeKb: (webpBuffer.length / 1024).toFixed(1),
    webpPath,
    jsonPath,
    jsonCreated,
  };

  if (reportScale) {
    console.log(`[Scale Report] Island "${islandId}":`);
    console.log(
      `  Source: ${origW}x${origH} -> Processed: ${finalW}x${finalH} (scale factor: ~${appliedScale.toFixed(2)})`
    );
    console.log(
      `  At standard 16x32 character size, a 30px doorway corresponds to ~${((30 / finalH) * 100).toFixed(1)}% island height.`
    );
  }

  return result;
}

// CLI entry point
if (
  process.argv[1] &&
  import.meta.url.endsWith(path.basename(process.argv[1]))
) {
  const args = process.argv.slice(2);
  const positionals = [];
  let width,
    scale,
    fuzz = 18,
    reportScale = false,
    outputDir;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--width" && i + 1 < args.length) {
      width = parseInt(args[++i], 10);
    } else if (arg === "--scale" && i + 1 < args.length) {
      scale = parseInt(args[++i], 10);
    } else if (arg === "--fuzz" && i + 1 < args.length) {
      fuzz = parseFloat(args[++i]);
    } else if (arg === "--output-dir" && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (arg === "--report-scale") {
      reportScale = true;
    } else if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  if (positionals.length < 2) {
    console.error(
      "Usage: npm run art:island -- <islandId> <source-image> [--width <px>] [--scale <N>] [--fuzz <percent>] [--report-scale]"
    );
    process.exit(1);
  }

  const [islandId, src] = positionals;

  try {
    const result = await processIsland({
      islandId,
      src,
      width,
      scale,
      fuzz,
      outputDir,
      reportScale,
    });

    console.log(`✓ Processed island "${result.islandId}":`);
    console.log(
      `  - Native size: ${result.finalSize.w}x${result.finalSize.h} (from ${result.originalSize.w}x${result.originalSize.h}, ${result.scaleMode})`
    );
    console.log(`  - Palette: ${result.colorCount} colors (budget <= 64)`);
    console.log(`  - File size: ${result.fileSizeKb} KB (budget <= 300 KB)`);
    console.log(`  - Output: ${result.webpPath}`);
    if (result.jsonCreated)
      console.log(`  - Starter metadata: ${result.jsonPath}`);
  } catch (err) {
    console.error("Error processing island:", err);
    process.exit(1);
  }
}
