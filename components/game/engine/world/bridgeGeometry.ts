/**
 * Pure geometric and layout computations for sky islands and bridges.
 *
 * Implements:
 * - Island placement scaling and derived world bounds
 * - Automatic bridge anchor detection from material map walkability
 * - Corridor geometry and point-in-corridor collision testing
 * - Layout bounds and overlap validation
 *
 * This module is completely pure and does not import Phaser, making it
 * directly testable via Vitest in Node.js.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface BridgeCorridor {
  fromIslandId: string;
  toIslandId: string;
  style: "rope" | "stone";
  start: Point2D;
  end: Point2D;
  width: number;
  length: number;
  angle: number;
  overlap: number;
}

export interface IslandArtLike {
  size: { w: number; h: number };
  anchors?: Array<{ id: string; at: [number, number] }>;
}

export interface IslandLayout {
  id: string;
  centerX: number;
  centerY: number;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
}

export interface WorldLayoutResult {
  islands: Map<string, IslandLayout>;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  origin: Point2D;
}

/**
 * Creates a BridgeCorridor with precomputed length, orientation angle, and overlap.
 */
export function createBridgeCorridor(options: {
  fromIslandId: string;
  toIslandId: string;
  style?: "rope" | "stone";
  start: Point2D;
  end: Point2D;
  width?: number;
  overlap?: number;
}): BridgeCorridor {
  const {
    fromIslandId,
    toIslandId,
    style = "rope",
    start,
    end,
    width = 14,
    overlap = 12,
  } = options;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  return {
    fromIslandId,
    toIslandId,
    style,
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
    width,
    length,
    angle,
    overlap,
  };
}

/**
 * Tests whether a point (px, py) lies inside the walkable corridor of a bridge,
 * including the transition overlap at both endpoints and lateral width tolerance.
 */
export function isPointInCorridor(
  corridor: BridgeCorridor,
  px: number,
  py: number
): boolean {
  if (corridor.length <= 0) return false;

  const dx = corridor.end.x - corridor.start.x;
  const dy = corridor.end.y - corridor.start.y;
  const len = corridor.length;

  // Unit vector along the bridge
  const ux = dx / len;
  const uy = dy / len;

  // Unit normal vector perpendicular to the bridge
  const nx = -uy;
  const ny = ux;

  // Vector from corridor start to test point
  const vx = px - corridor.start.x;
  const vy = py - corridor.start.y;

  // Longitudinal projection along bridge axis
  const t = vx * ux + vy * uy;

  // Check longitudinal bounds (with overlap extension on both ends)
  if (t < -corridor.overlap || t > len + corridor.overlap) {
    return false;
  }

  // Lateral projection (perpendicular distance from centerline)
  const d = vx * nx + vy * ny;

  return Math.abs(d) <= corridor.width / 2;
}

/**
 * Checks whether an RGB pixel in the material map represents walkable ground (road or grass).
 */
export function isWalkableMaterial(r: number, g: number, b: number): boolean {
  // Road: white/light grey cobblestone (r > 200, g > 200, b > 200)
  const isRoad = r > 200 && g > 200 && b > 200;
  // Grass: vibrant green (r < 50, g > 150, b < 50)
  const isGrass = r < 50 && g > 150 && b < 50;
  return isRoad || isGrass;
}

export interface MaterialMapLike {
  width: number;
  height: number;
  pixels: Uint8Array | Uint8ClampedArray | number[];
  channels?: number;
}

export interface IslandMaterialContext {
  islandId: string;
  worldX: number;
  worldY: number;
  material: MaterialMapLike;
}

export interface DeckCollisionHit {
  islandId: string;
  worldX: number;
  worldY: number;
  localX: number;
  localY: number;
  material: string;
  distance: number;
}

/**
 * Checks whether an RGB(A) sample represents a deck-blocking material (cliff, water, solid, or roof).
 */
export function isBlockingDeckMaterial(
  r: number,
  g: number,
  b: number,
  a = 255
): boolean {
  if (a < 128) return false;

  // Cliff: reddish brown (r ~ 128, g ~ 64, b ~ 0)
  if (r >= 100 && r <= 155 && g >= 40 && g <= 90 && b <= 35) {
    return true;
  }
  // Water: deep blue (r < 60, g < 60, b > 180)
  if (r < 60 && g < 60 && b > 180) {
    return true;
  }
  // Solid: bright red obstacle (r > 200, g < 50, b < 50)
  if (r > 200 && g < 50 && b < 50) {
    return true;
  }
  // Roof: orange obstacle (r > 200, g >= 100 && g <= 160, b < 50)
  if (r > 200 && g >= 100 && g <= 160 && b < 50) {
    return true;
  }
  return false;
}

/**
 * Samples along a deck line between two islands' anchors (outside the 12px overlap at each end)
 * against both islands' material maps. Returns all collision hits where the deck line
 * intersects cliff, water, or solid obstacles.
 */
export function sampleDeckCollisions(
  fromIsland: IslandMaterialContext,
  toIsland: IslandMaterialContext,
  start: Point2D,
  end: Point2D,
  overlap = 12,
  sampleStep = 2
): DeckCollisionHit[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= overlap * 2) {
    return [];
  }

  const hits: DeckCollisionHit[] = [];
  const islands = [fromIsland, toIsland];

  for (let d = overlap; d <= length - overlap; d += sampleStep) {
    const t = d / length;
    const wx = start.x + dx * t;
    const wy = start.y + dy * t;

    for (const isl of islands) {
      const lx = Math.round(wx - isl.worldX);
      const ly = Math.round(wy - isl.worldY);

      if (
        lx >= 0 &&
        lx < isl.material.width &&
        ly >= 0 &&
        ly < isl.material.height
      ) {
        const channels = isl.material.channels ?? 3;
        const idx = (ly * isl.material.width + lx) * channels;
        const r = isl.material.pixels[idx] ?? 0;
        const g = isl.material.pixels[idx + 1] ?? 0;
        const b = isl.material.pixels[idx + 2] ?? 0;
        const a = channels >= 4 ? (isl.material.pixels[idx + 3] ?? 255) : 255;

        if (isBlockingDeckMaterial(r, g, b, a)) {
          let matName = "solid";
          if (r >= 100 && r <= 155 && g >= 40 && g <= 90 && b <= 35)
            matName = "cliff";
          else if (r < 60 && g < 60 && b > 180) matName = "water";
          else if (r > 200 && g >= 100 && g <= 160 && b < 50) matName = "roof";

          hits.push({
            islandId: isl.islandId,
            worldX: Math.round(wx),
            worldY: Math.round(wy),
            localX: lx,
            localY: ly,
            material: matName,
            distance: d,
          });
        }
      }
    }
  }

  return hits;
}

/**
 * Computes an anchor automatically on an island: the walkable (road|grass)
 * material pixel closest to the other island's centre, on the top-surface lip
 * bordering void (never pixels that only border cliff underside).
 *
 * For targets below the island (south), prefers side lips (east/west)
 * so the deck avoids crossing the southern cliff underside or waterfalls.
 *
 * Returns pixel coordinates in native island space [0..matWidth-1, 0..matHeight-1].
 */
export function findAutomaticAnchor(
  materialPixels: Uint8Array | Uint8ClampedArray | number[],
  matWidth: number,
  matHeight: number,
  islandWorldCenter: Point2D,
  targetWorldCenter: Point2D
): Point2D {
  const originX = islandWorldCenter.x - matWidth / 2;
  const originY = islandWorldCenter.y - matHeight / 2;
  const channels = materialPixels.length >= matWidth * matHeight * 4 ? 4 : 3;

  function isVoid(px: number, py: number): boolean {
    if (px < 0 || px >= matWidth || py < 0 || py >= matHeight) return true;
    const idx = (py * matWidth + px) * channels;
    const a = channels >= 4 ? (materialPixels[idx + 3] ?? 255) : 255;
    if (a < 128) return true;
    const r = materialPixels[idx] ?? 0;
    const g = materialPixels[idx + 1] ?? 0;
    const b = materialPixels[idx + 2] ?? 0;
    return r > 200 && b > 200 && g < 50;
  }

  function bordersVoid(px: number, py: number): boolean {
    return (
      isVoid(px - 1, py) ||
      isVoid(px + 1, py) ||
      isVoid(px, py - 1) ||
      isVoid(px, py + 1)
    );
  }

  const isTargetBelow = targetWorldCenter.y > islandWorldCenter.y + 40;

  let bestDistSq = Infinity;
  let bestPt: Point2D = {
    x: Math.round(matWidth / 2),
    y: Math.round(matHeight / 2),
  };

  const stride = 1;
  // First pass: look strictly for walkable pixels that border void (top-surface lip)
  for (let y = 0; y < matHeight; y += stride) {
    for (let x = 0; x < matWidth; x += stride) {
      const idx = (y * matWidth + x) * channels;
      const r = materialPixels[idx] ?? 0;
      const g = materialPixels[idx + 1] ?? 0;
      const b = materialPixels[idx + 2] ?? 0;

      if (isWalkableMaterial(r, g, b) && bordersVoid(x, y)) {
        const wx = originX + x;
        const wy = originY + y;
        let dsq =
          (wx - targetWorldCenter.x) ** 2 + (wy - targetWorldCenter.y) ** 2;

        // If target is below, penalize center-south cliff underside
        if (isTargetBelow) {
          const distFromHorizCenter = Math.abs(x - matWidth / 2);
          if (distFromHorizCenter < matWidth * 0.25) {
            dsq += 500000; // Strong penalty favoring side lips (east / west)
          }
        }

        if (dsq < bestDistSq) {
          bestDistSq = dsq;
          bestPt = { x, y };
        }
      }
    }
  }

  // Fallback if no void-bordering pixel found
  if (bestDistSq === Infinity) {
    for (let y = 0; y < matHeight; y += stride) {
      for (let x = 0; x < matWidth; x += stride) {
        const idx = (y * matWidth + x) * channels;
        const r = materialPixels[idx] ?? 0;
        const g = materialPixels[idx + 1] ?? 0;
        const b = materialPixels[idx + 2] ?? 0;

        if (isWalkableMaterial(r, g, b)) {
          const wx = originX + x;
          const wy = originY + y;
          const dsq =
            (wx - targetWorldCenter.x) ** 2 + (wy - targetWorldCenter.y) ** 2;
          if (dsq < bestDistSq) {
            bestDistSq = dsq;
            bestPt = { x, y };
          }
        }
      }
    }
  }

  return bestPt;
}

/**
 * Resolves the anchor point for a bridge on an island:
 * 1. Uses explicit `islandArt.anchors` entry matching `to_<targetIslandId>` if present.
 * 2. Otherwise computes automatic anchor from material map pixels closest to target center.
 * 3. Falls back to edge contact point if material map pixels are unavailable.
 */
export function resolveIslandAnchor(
  targetIslandId: string,
  islandArt: IslandArtLike,
  islandWorldCenter: Point2D,
  targetWorldCenter: Point2D,
  materialPixels?: Uint8Array | Uint8ClampedArray | number[]
): Point2D {
  const explicitAnchor = islandArt.anchors?.find(
    (a) => a.id === `to_${targetIslandId}` || a.id === targetIslandId
  );

  if (explicitAnchor) {
    return { x: explicitAnchor.at[0], y: explicitAnchor.at[1] };
  }

  if (
    materialPixels &&
    materialPixels.length >= islandArt.size.w * islandArt.size.h * 3
  ) {
    return findAutomaticAnchor(
      materialPixels,
      islandArt.size.w,
      islandArt.size.h,
      islandWorldCenter,
      targetWorldCenter
    );
  }

  // Fallback geometric edge intersection
  const dx = targetWorldCenter.x - islandWorldCenter.x;
  const dy = targetWorldCenter.y - islandWorldCenter.y;
  const angle = Math.atan2(dy, dx);
  const rx = islandArt.size.w * 0.45;
  const ry = islandArt.size.h * 0.35;

  return {
    x: Math.round(islandArt.size.w / 2 + Math.cos(angle) * rx),
    y: Math.round(islandArt.size.h / 2 + Math.sin(angle) * ry),
  };
}

/**
 * Computes the scaled positions of all islands and derives the encompassing world bounds.
 */
export function computeWorldLayout(
  islands: readonly { id: string; at: { x: number; y: number } }[],
  islandSizes: Record<string, { w: number; h: number }>,
  layoutScale: number,
  margin = 600
): WorldLayoutResult {
  // First calculate relative centers from seed coordinates (Home is 0, 0)
  const relativeLayouts: Array<{
    id: string;
    relCenterX: number;
    relCenterY: number;
    w: number;
    h: number;
  }> = [];

  let minRelX = Infinity;
  let maxRelX = -Infinity;
  let minRelY = Infinity;
  let maxRelY = -Infinity;

  for (const island of islands) {
    const size = islandSizes[island.id] ?? { w: 600, h: 700 };
    const relCenterX = island.at.x * 16 * layoutScale;
    const relCenterY = island.at.y * 16 * layoutScale;
    const left = relCenterX - size.w / 2;
    const right = relCenterX + size.w / 2;
    const top = relCenterY - size.h / 2;
    const bottom = relCenterY + size.h / 2;

    minRelX = Math.min(minRelX, left);
    maxRelX = Math.max(maxRelX, right);
    minRelY = Math.min(minRelY, top);
    maxRelY = Math.max(maxRelY, bottom);

    relativeLayouts.push({
      id: island.id,
      relCenterX,
      relCenterY,
      w: size.w,
      h: size.h,
    });
  }

  // Offset origin so world space has a comfortable positive margin
  const originX = Math.round(-minRelX + margin);
  const originY = Math.round(-minRelY + margin);

  const totalWidth = Math.round(maxRelX - minRelX + margin * 2);
  const totalHeight = Math.round(maxRelY - minRelY + margin * 2);

  const islandMap = new Map<string, IslandLayout>();
  for (const rel of relativeLayouts) {
    const centerX = Math.round(originX + rel.relCenterX);
    const centerY = Math.round(originY + rel.relCenterY);
    const worldX = Math.round(centerX - rel.w / 2);
    const worldY = Math.round(centerY - rel.h / 2);

    islandMap.set(rel.id, {
      id: rel.id,
      centerX,
      centerY,
      worldX,
      worldY,
      width: rel.w,
      height: rel.h,
    });
  }

  return {
    islands: islandMap,
    bounds: {
      minX: 0,
      minY: 0,
      maxX: totalWidth,
      maxY: totalHeight,
      width: totalWidth,
      height: totalHeight,
    },
    origin: { x: originX, y: originY },
  };
}

/**
 * Checks for island body footprint overlap between any pair of islands in a layout.
 * Uses the effective island body radius (approx. 45% of island dimensions),
 * accounting for transparent sky margins in raw images.
 */
export function checkLayoutOverlap(layouts: Iterable<IslandLayout>): {
  overlaps: Array<{ a: string; b: string }>;
  minClearance: number;
} {
  const items = Array.from(layouts);
  const overlaps: Array<{ a: string; b: string }> = [];
  let minClearance = Infinity;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;

      const dist = Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY);
      // Effective island body radii (excluding transparent sky padding)
      const radA = Math.min(a.width, a.height) * 0.42;
      const radB = Math.min(b.width, b.height) * 0.42;
      const clearance = dist - (radA + radB);

      if (clearance < 0) {
        overlaps.push({ a: a.id, b: b.id });
      }

      minClearance = Math.min(minClearance, clearance);
    }
  }

  return { overlaps, minClearance };
}
