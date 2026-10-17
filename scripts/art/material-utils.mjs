/**
 * Living World Material Map Utilities.
 *
 * Implements material palette mapping, nearest-neighbor palette snapping,
 * speck cleanup, and auto heuristic material map generation per `docs/LIVING_WORLD_SPEC.md`.
 */

export const MATERIAL_PALETTE = {
  void: [255, 0, 255], // Outside the island (alpha 0 in art)
  road: [255, 255, 255], // Dirt/cobble paths, plazas, stairs, bridge decks
  grass: [0, 200, 0], // Walkable meadow / ground
  solid: [255, 0, 0], // Walls, fences, rocks, statues, trunks
  roof: [255, 128, 0], // Roofs / upper building parts (occluders)
  canopy: [0, 80, 0], // Tree crowns / canopy (walkable under, sway shader)
  water: [0, 0, 255], // Waterfalls, streams, pools (flow shader)
  cliff: [128, 64, 0], // Island edge/underside hard boundary
  cloth: [255, 255, 0], // Banners, flags, awnings (flutter shader)
  fire: [255, 0, 128], // Forge fire, lamps (flicker + glow)
};

export const PALETTE_ENTRIES = Object.entries(MATERIAL_PALETTE).map(
  ([name, rgb]) => ({
    name,
    rgb,
    r: rgb[0],
    g: rgb[1],
    b: rgb[2],
  })
);

/**
 * Snaps an arbitrary [r, g, b] color to the nearest material palette color.
 */
export function snapToNearestPalette(r, g, b) {
  let bestEntry = PALETTE_ENTRIES[0];
  let minDistanceSq = Infinity;

  for (const entry of PALETTE_ENTRIES) {
    const dr = r - entry.r;
    const dg = g - entry.g;
    const db = b - entry.b;
    const distSq = dr * dr + dg * dg + db * db;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestEntry = entry;
      if (distSq === 0) break;
    }
  }

  return { name: bestEntry.name, rgb: bestEntry.rgb };
}

/**
 * Snaps every RGB pixel in a buffer to the nearest palette color.
 */
export function snapBufferToPalette(buffer, width, height, channels = 3) {
  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * channels;
      const dstIdx = (y * width + x) * 3;
      const { rgb } = snapToNearestPalette(
        buffer[srcIdx],
        buffer[srcIdx + 1],
        buffer[srcIdx + 2]
      );
      out[dstIdx] = rgb[0];
      out[dstIdx + 1] = rgb[1];
      out[dstIdx + 2] = rgb[2];
    }
  }
  return out;
}

/**
 * Morphological speck removal:
 * Identifies connected components of identical palette color.
 * Any component smaller than `minSize` pixels is remapped to its most frequent neighboring color.
 */
export function removeSpecks(buffer, width, height, minSize = 6) {
  const numPixels = width * height;
  const out = Buffer.from(buffer);

  const colors = new Uint32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    colors[i] = (out[i * 3] << 16) | (out[i * 3 + 1] << 8) | out[i * 3 + 2];
  }

  const visited = new Uint8Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    if (visited[i]) continue;
    const c = colors[i];
    const comp = [i];
    visited[i] = 1;
    let head = 0;

    while (head < comp.length) {
      const idx = comp[head++];
      const cx = idx % width;
      const cy = Math.floor(idx / width);

      const neighbors = [
        cy > 0 ? idx - width : -1,
        cy < height - 1 ? idx + width : -1,
        cx > 0 ? idx - 1 : -1,
        cx < width - 1 ? idx + 1 : -1,
      ];

      for (const n of neighbors) {
        if (n !== -1 && !visited[n] && colors[n] === c) {
          visited[n] = 1;
          comp.push(n);
        }
      }
    }

    if (comp.length < minSize) {
      const neighborCounts = new Map();
      for (const idx of comp) {
        const cx = idx % width;
        const cy = Math.floor(idx / width);
        const neighbors = [
          cy > 0 ? idx - width : -1,
          cy < height - 1 ? idx + width : -1,
          cx > 0 ? idx - 1 : -1,
          cx < width - 1 ? idx + 1 : -1,
        ];
        for (const n of neighbors) {
          if (n !== -1 && colors[n] !== c) {
            const nc = colors[n];
            neighborCounts.set(nc, (neighborCounts.get(nc) || 0) + 1);
          }
        }
      }

      let bestColor = c;
      let maxCount = 0;
      for (const [nc, count] of neighborCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          bestColor = nc;
        }
      }

      if (bestColor !== c) {
        for (const idx of comp) {
          colors[idx] = bestColor;
          out[idx * 3] = (bestColor >> 16) & 0xff;
          out[idx * 3 + 1] = (bestColor >> 8) & 0xff;
          out[idx * 3 + 2] = bestColor & 0xff;
        }
      }
    }
  }

  return out;
}

/**
 * Generates an auto material map from an island's RGBA pixel buffer based on
 * the heuristics in `docs/LIVING_WORLD_SPEC.md`:
 * - alpha 0 -> void
 * - blue-dominant -> water
 * - high-saturation green -> grass
 * - dark low-luminance green blobs -> canopy
 * - light low-texture tan / paved -> road
 * - alpha edge band ~4 px near bottom outline / underside rock -> cliff
 * - rest -> solid
 */
export function generateAutoMaterial(islandRgba, width, height, options = {}) {
  const { minSpeckSize = 6, cliffBand = 4 } = options;
  const numPixels = width * height;
  const mat = Buffer.alloc(numPixels * 3);

  // 1. Identify alpha mask and distance to transparent void (within 6px)
  const isOpaque = new Uint8Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    isOpaque[i] = islandRgba[i * 4 + 3] > 0 ? 1 : 0;
  }

  const distToVoid = new Uint8Array(numPixels);
  distToVoid.fill(255);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!isOpaque[idx]) {
        distToVoid[idx] = 0;
        continue;
      }
      let minD = 255;
      for (let dy = -cliffBand; dy <= cliffBand; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -cliffBand; dx <= cliffBand; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          if (!isOpaque[ny * width + nx]) {
            const d = Math.hypot(dx, dy);
            if (d < minD) minD = d;
          }
        }
      }
      distToVoid[idx] = Math.round(minD);
    }
  }

  // 2. Classify each pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const i4 = idx * 4;
      const i3 = idx * 3;
      const a = islandRgba[i4 + 3];

      if (a === 0) {
        mat[i3] = MATERIAL_PALETTE.void[0];
        mat[i3 + 1] = MATERIAL_PALETTE.void[1];
        mat[i3 + 2] = MATERIAL_PALETTE.void[2];
        continue;
      }

      const r = islandRgba[i4];
      const g = islandRgba[i4 + 1];
      const b = islandRgba[i4 + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      let cls = "solid";

      // Underside cliff edge band and rock
      if (y > height * 0.5 && distToVoid[idx] <= cliffBand) {
        cls = "cliff";
      } else if (
        y > height * 0.65 &&
        r > b &&
        r - b > 10 &&
        lum < 130 &&
        !(g > r + 10)
      ) {
        cls = "cliff";
      } else if (
        // Water (blue dominant, water streams/waterfalls/pools)
        b > r + 15 &&
        b > g - 15 &&
        b > 80 &&
        y > height * 0.35
      ) {
        cls = "water";
      } else if (g > r && g > b) {
        // Green foliage
        if (lum < 95 || (g < 110 && sat > 0.2)) {
          cls = "canopy";
        } else if (sat > 0.22 || g > 110) {
          cls = "grass";
        } else {
          cls = "solid";
        }
      } else if (
        // Light low-texture tan / stone paved roads, plazas, and stairs
        (lum > 110 &&
          sat < 0.42 &&
          r > 110 &&
          g > 95 &&
          b > 70 &&
          r >= g &&
          g >= b) ||
        (lum > 135 &&
          sat < 0.5 &&
          r > 150 &&
          g > 130 &&
          b > 100 &&
          r >= g &&
          g >= b) ||
        // Desert sand walkable ground (warm tan/sand top ground surface)
        (y < height * 0.62 &&
          y > height * 0.25 &&
          r > 165 &&
          g > 115 &&
          b > 55 &&
          r > g &&
          g > b &&
          sat < 0.65 &&
          lum > 115)
      ) {
        cls = "road";
      } else if (
        // Cherry blossom tree canopy (pink/white floral tree crowns in spring, b > g - 10)
        y < height * 0.65 &&
        r > 175 &&
        g > 110 &&
        g < 210 &&
        b > 130 &&
        b >= g - 15 &&
        r >= b &&
        sat > 0.15 &&
        sat < 0.45
      ) {
        cls = "canopy";
      } else if (
        // Autumn tree foliage (Saleh island: warm golden/orange/crimson crowns)
        y < height * 0.55 &&
        r > 130 &&
        g > 40 &&
        g < 135 &&
        b < 75
      ) {
        cls = "canopy";
      }

      const col = MATERIAL_PALETTE[cls] || MATERIAL_PALETTE.solid;
      mat[i3] = col[0];
      mat[i3 + 1] = col[1];
      mat[i3 + 2] = col[2];
    }
  }

  // 3. Remove specks < minSpeckSize
  return removeSpecks(mat, width, height, minSpeckSize);
}

/**
 * Creates a debug overlay buffer blending the material colors (50% opacity)
 * on top of the original island RGBA image.
 */
export function generateDebugOverlay(
  islandRgba,
  materialRgb,
  width,
  height,
  opacity = 0.5
) {
  const overlay = Buffer.alloc(width * height * 4);
  const invOp = 1 - opacity;

  for (let i = 0; i < width * height; i++) {
    const i4 = i * 4;
    const i3 = i * 3;
    const a = islandRgba[i4 + 3];

    if (a === 0) {
      overlay[i4] = 0;
      overlay[i4 + 1] = 0;
      overlay[i4 + 2] = 0;
      overlay[i4 + 3] = 0;
    } else {
      overlay[i4] = Math.round(
        islandRgba[i4] * invOp + materialRgb[i3] * opacity
      );
      overlay[i4 + 1] = Math.round(
        islandRgba[i4 + 1] * invOp + materialRgb[i3 + 1] * opacity
      );
      overlay[i4 + 2] = Math.round(
        islandRgba[i4 + 2] * invOp + materialRgb[i3 + 2] * opacity
      );
      overlay[i4 + 3] = 255;
    }
  }

  return overlay;
}
