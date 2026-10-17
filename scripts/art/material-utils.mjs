/**
 * Living World Material Map Utilities.
 *
 * Implements material palette mapping, nearest-neighbor palette snapping,
 * outline fill, road snag cleanup, and segmentation processing per `docs/LIVING_WORLD_SPEC.md`.
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

export function packRgb(r, g, b) {
  return (r << 16) | (g << 8) | b;
}

export function unpackRgb(packed) {
  return [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff];
}

export const PACKED_PALETTE = {
  void: packRgb(...MATERIAL_PALETTE.void),
  road: packRgb(...MATERIAL_PALETTE.road),
  grass: packRgb(...MATERIAL_PALETTE.grass),
  solid: packRgb(...MATERIAL_PALETTE.solid),
  roof: packRgb(...MATERIAL_PALETTE.roof),
  canopy: packRgb(...MATERIAL_PALETTE.canopy),
  water: packRgb(...MATERIAL_PALETTE.water),
  cliff: packRgb(...MATERIAL_PALETTE.cliff),
  cloth: packRgb(...MATERIAL_PALETTE.cloth),
  fire: packRgb(...MATERIAL_PALETTE.fire),
};

export const UNKNOWN_COLOR = 0xffffffff;

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

  return {
    name: bestEntry.name,
    rgb: bestEntry.rgb,
    distance: Math.sqrt(minDistanceSq),
  };
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
 * Fills UNKNOWN pixels (from black outlines or anti-aliased edge fringes)
 * using a majority (mode) filter of their known neighbors (3x3 then 5x5).
 */
export function fillUnknownPixels(colorArray, width, height) {
  for (let pass = 1; pass <= 2; pass++) {
    const radius = pass === 1 ? 1 : 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (colorArray[idx] !== UNKNOWN_COLOR) continue;

        const counts = new Map();
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const c = colorArray[ny * width + nx];
            if (c !== UNKNOWN_COLOR) {
              counts.set(c, (counts.get(c) || 0) + 1);
            }
          }
        }

        if (counts.size > 0) {
          let best = UNKNOWN_COLOR;
          let maxCount = 0;
          for (const [c, cnt] of counts.entries()) {
            if (cnt > maxCount) {
              maxCount = cnt;
              best = c;
            }
          }
          colorArray[idx] = best;
        }
      }
    }
  }

  // Fallback for any remaining isolated unknown pixel
  for (let i = 0; i < colorArray.length; i++) {
    if (colorArray[i] === UNKNOWN_COLOR) {
      colorArray[i] = PACKED_PALETTE.solid;
    }
  }
}

/**
 * Removes obstacle specks (solid, roof, canopy) smaller than or equal to `maxSnagSize`
 * that are surrounded by walkable ground (road or grass).
 * Prevents invisible 1-12px walls from snagging the player.
 */
export function removeRoadSnags(colorArray, width, height, maxSnagSize = 12) {
  const numPixels = width * height;
  const visited = new Uint8Array(numPixels);

  const ROAD = PACKED_PALETTE.road;
  const GRASS = PACKED_PALETTE.grass;
  const SOLID = PACKED_PALETTE.solid;
  const ROOF = PACKED_PALETTE.roof;
  const CANOPY = PACKED_PALETTE.canopy;

  for (let i = 0; i < numPixels; i++) {
    if (visited[i]) continue;
    const c = colorArray[i];
    const isObstacle = c === SOLID || c === ROOF || c === CANOPY;
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
        if (n !== -1 && !visited[n] && colorArray[n] === c) {
          visited[n] = 1;
          comp.push(n);
        }
      }
    }

    if (isObstacle && comp.length <= maxSnagSize) {
      const boundaryCounts = new Map();
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
          if (n !== -1 && colorArray[n] !== c) {
            const nc = colorArray[n];
            boundaryCounts.set(nc, (boundaryCounts.get(nc) || 0) + 1);
          }
        }
      }

      const roadCount = boundaryCounts.get(ROAD) || 0;
      const grassCount = boundaryCounts.get(GRASS) || 0;
      const walkableCount = roadCount + grassCount;
      let totalBoundary = 0;
      for (const cnt of boundaryCounts.values()) totalBoundary += cnt;

      if (totalBoundary > 0 && walkableCount / totalBoundary >= 0.7) {
        const fill = roadCount >= grassCount ? ROAD : GRASS;
        for (const idx of comp) {
          colorArray[idx] = fill;
        }
      }
    }
  }
}

/**
 * General speck removal: re-maps components smaller than `minSize` pixels
 * to their most frequent neighboring color.
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
 * Full AI segmentation map processor:
 * - Maps transparent art pixels to `void`
 * - Flags black outlines & distant fringe as UNKNOWN
 * - Fills UNKNOWN pixels with majority filter (3x3 then 5x5)
 * - Removes obstacle specks <= 12 px surrounded by road or grass
 * - Cleans specks < 6 px
 */
export function processSegmentationMap(
  mapRgb,
  width,
  height,
  artAlpha = null,
  options = {}
) {
  const { maxSnagSize = 12, minSpeckSize = 6 } = options;
  const numPixels = width * height;
  const colorArray = new Uint32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    if (artAlpha && artAlpha[i * 4 + 3] === 0) {
      colorArray[i] = PACKED_PALETTE.void;
      continue;
    }

    const r = mapRgb[i * 3];
    const g = mapRgb[i * 3 + 1];
    const b = mapRgb[i * 3 + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const max = Math.max(r, g, b);

    // Black outline strokes from Gemini: dark and low saturation
    if (lum < 45 && max < 55) {
      colorArray[i] = UNKNOWN_COLOR;
      continue;
    }

    const snapped = snapToNearestPalette(r, g, b);
    if (snapped.distance > 80) {
      // Anti-aliased boundary fringe far from palette
      colorArray[i] = UNKNOWN_COLOR;
      continue;
    }

    colorArray[i] = packRgb(...snapped.rgb);
  }

  // Majority filter for outlines
  fillUnknownPixels(colorArray, width, height);

  // Remove snagging obstacle specks on road or grass
  if (maxSnagSize > 0) {
    removeRoadSnags(colorArray, width, height, maxSnagSize);
  }

  // Convert to RGB buffer
  const outRgb = Buffer.alloc(numPixels * 3);
  for (let i = 0; i < numPixels; i++) {
    const c = colorArray[i];
    outRgb[i * 3] = (c >> 16) & 0xff;
    outRgb[i * 3 + 1] = (c >> 8) & 0xff;
    outRgb[i * 3 + 2] = c & 0xff;
  }

  // General speck cleanup
  const cleanedRgb =
    minSpeckSize > 1
      ? removeSpecks(outRgb, width, height, minSpeckSize)
      : outRgb;

  return cleanedRgb;
}

/**
 * Computes per-class pixel counts and percentages.
 */
export function computeClassHistogram(materialRgb, width, height) {
  const numPixels = width * height;
  const counts = {};
  for (const name of Object.keys(MATERIAL_PALETTE)) {
    counts[name] = 0;
  }

  const nameByPack = new Map();
  for (const [name, rgb] of Object.entries(MATERIAL_PALETTE)) {
    nameByPack.set(packRgb(...rgb), name);
  }

  for (let i = 0; i < numPixels; i++) {
    const packed = packRgb(
      materialRgb[i * 3],
      materialRgb[i * 3 + 1],
      materialRgb[i * 3 + 2]
    );
    const name = nameByPack.get(packed) || "other";
    counts[name] = (counts[name] || 0) + 1;
  }

  const histogram = {};
  for (const [name, count] of Object.entries(counts)) {
    histogram[name] = {
      count,
      percent: (count / numPixels) * 100,
      percentStr: `${((count / numPixels) * 100).toFixed(2)}%`,
    };
  }

  return histogram;
}

/**
 * Generates an auto material map from an island's RGBA pixel buffer based on heuristics.
 */
export function generateAutoMaterial(islandRgba, width, height, options = {}) {
  const { minSpeckSize = 6, cliffBand = 4 } = options;
  const numPixels = width * height;
  const mat = Buffer.alloc(numPixels * 3);

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
      } else if (b > r + 15 && b > g - 15 && b > 80 && y > height * 0.35) {
        cls = "water";
      } else if (g > r && g > b) {
        if (lum < 95 || (g < 110 && sat > 0.2)) {
          cls = "canopy";
        } else if (sat > 0.22 || g > 110) {
          cls = "grass";
        } else {
          cls = "solid";
        }
      } else if (
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
      } else if (y < height * 0.55 && r > 130 && g > 40 && g < 135 && b < 75) {
        cls = "canopy";
      }

      const col = MATERIAL_PALETTE[cls] || MATERIAL_PALETTE.solid;
      mat[i3] = col[0];
      mat[i3 + 1] = col[1];
      mat[i3 + 2] = col[2];
    }
  }

  return removeSpecks(mat, width, height, minSpeckSize);
}

/**
 * Creates a debug overlay buffer blending material colors on top of the island art.
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
