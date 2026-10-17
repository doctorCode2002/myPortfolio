import { describe, expect, it } from "vitest";
import {
  createBridgeCorridor,
  isPointInCorridor,
  isWalkableMaterial,
  findAutomaticAnchor,
  resolveIslandAnchor,
  computeWorldLayout,
  checkLayoutOverlap,
} from "./bridgeGeometry";

describe("Bridge Geometry and Layout Logic", () => {
  describe("isWalkableMaterial", () => {
    it("recognizes road and grass as walkable ground", () => {
      expect(isWalkableMaterial(255, 255, 255)).toBe(true); // Road
      expect(isWalkableMaterial(220, 220, 220)).toBe(true); // Cobble road
      expect(isWalkableMaterial(0, 200, 0)).toBe(true); // Grass
      expect(isWalkableMaterial(20, 180, 20)).toBe(true); // Lush grass
    });

    it("rejects void, water, cliff, and building walls", () => {
      expect(isWalkableMaterial(255, 0, 255)).toBe(false); // Void
      expect(isWalkableMaterial(0, 0, 255)).toBe(false); // Water
      expect(isWalkableMaterial(128, 64, 0)).toBe(false); // Cliff
      expect(isWalkableMaterial(255, 0, 0)).toBe(false); // Solid wall
    });
  });

  describe("BridgeCorridor and Point-in-Corridor Collision", () => {
    // Horizontal corridor from (100, 200) to (300, 200), width 14, overlap 12
    const corridor = createBridgeCorridor({
      fromIslandId: "home",
      toIslandId: "khidmty",
      style: "stone",
      start: { x: 100, y: 200 },
      end: { x: 300, y: 200 },
      width: 14,
      overlap: 12,
    });

    it("computes accurate length and angle", () => {
      expect(corridor.length).toBe(200);
      expect(corridor.angle).toBe(0);
      expect(corridor.width).toBe(14);
      expect(corridor.overlap).toBe(12);
    });

    it("allows walking inside the corridor along the center line", () => {
      expect(isPointInCorridor(corridor, 100, 200)).toBe(true); // Start
      expect(isPointInCorridor(corridor, 200, 200)).toBe(true); // Middle
      expect(isPointInCorridor(corridor, 300, 200)).toBe(true); // End
    });

    it("allows walking inside the 12px overlap zone on island transitions", () => {
      expect(isPointInCorridor(corridor, 90, 200)).toBe(true); // 10px before start
      expect(isPointInCorridor(corridor, 88, 200)).toBe(true); // exactly 12px before start
      expect(isPointInCorridor(corridor, 310, 200)).toBe(true); // 10px past end
      expect(isPointInCorridor(corridor, 312, 200)).toBe(true); // exactly 12px past end
    });

    it("rejects points past the overlap limit along the axis", () => {
      expect(isPointInCorridor(corridor, 80, 200)).toBe(false); // 20px before start (> 12px overlap)
      expect(isPointInCorridor(corridor, 320, 200)).toBe(false); // 20px past end (> 12px overlap)
    });

    it("enforces the 14px lateral width limit (within 7px of centerline)", () => {
      // y=200 is centerline. Width 14 means y in [193, 207]
      expect(isPointInCorridor(corridor, 200, 205)).toBe(true); // 5px off center
      expect(isPointInCorridor(corridor, 200, 207)).toBe(true); // 7px off center
      expect(isPointInCorridor(corridor, 200, 208)).toBe(false); // 8px off center (outside railing)
      expect(isPointInCorridor(corridor, 200, 193)).toBe(true); // -7px off center
      expect(isPointInCorridor(corridor, 200, 191)).toBe(false); // -9px off center (outside railing)
    });

    it("handles angled 45-degree corridors correctly", () => {
      // 45 degree diagonal from (0, 0) to (100, 100), length = 100 * sqrt(2) ≈ 141.42
      const diag = createBridgeCorridor({
        fromIslandId: "home",
        toIslandId: "civicmind",
        style: "rope",
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        width: 14,
        overlap: 12,
      });

      expect(diag.angle).toBeCloseTo(Math.PI / 4, 3);
      expect(diag.length).toBeCloseTo(141.42, 1);

      // On the centerline at (50, 50)
      expect(isPointInCorridor(diag, 50, 50)).toBe(true);

      // 4px perpendicular displacement: perpendicular unit vector is (-sqrt(2)/2, sqrt(2)/2)
      // (50 - 4*0.707, 50 + 4*0.707) ≈ (47.17, 52.83)
      expect(isPointInCorridor(diag, 47.17, 52.83)).toBe(true);

      // 10px perpendicular displacement: outside 7px half-width
      // (50 - 10*0.707, 50 + 10*0.707) ≈ (42.93, 57.07)
      expect(isPointInCorridor(diag, 42.93, 57.07)).toBe(false);
    });
  });

  describe("findAutomaticAnchor", () => {
    it("finds the walkable pixel on the edge closest to target island center", () => {
      const w = 40;
      const h = 40;
      const pixels = new Uint8Array(w * h * 3); // All 0 (solid)

      // Place a road patch on the East edge at x in [35, 39], y in [18, 22]
      for (let y = 18; y <= 22; y++) {
        for (let x = 35; x <= 39; x++) {
          const idx = (y * w + x) * 3;
          pixels[idx] = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
        }
      }

      // Target island center is far to the East at (500, 0) relative to island center at (0, 0)
      const anchor = findAutomaticAnchor(
        pixels,
        w,
        h,
        { x: 0, y: 0 },
        { x: 500, y: 0 }
      );

      // Should pick the easternmost pixel in the road patch
      expect(anchor.x).toBeGreaterThanOrEqual(35);
      expect(anchor.y).toBeGreaterThanOrEqual(18);
      expect(anchor.y).toBeLessThanOrEqual(22);
    });
  });

  describe("resolveIslandAnchor", () => {
    it("uses authored anchor in islandArt.anchors if present", () => {
      const art = {
        size: { w: 500, h: 500 },
        anchors: [
          { id: "to_khidmty", at: [250, 40] as [number, number] },
          { id: "to_civicmind", at: [480, 250] as [number, number] },
        ],
      };

      const anchorKhidmty = resolveIslandAnchor(
        "khidmty",
        art,
        { x: 0, y: 0 },
        { x: 0, y: -500 }
      );
      expect(anchorKhidmty).toEqual({ x: 250, y: 40 });

      const anchorCivic = resolveIslandAnchor(
        "civicmind",
        art,
        { x: 0, y: 0 },
        { x: 500, y: 0 }
      );
      expect(anchorCivic).toEqual({ x: 480, y: 250 });
    });

    it("falls back to automatic anchor when explicit anchor is missing", () => {
      const art = {
        size: { w: 30, h: 30 },
        anchors: [],
      };
      const pixels = new Uint8Array(30 * 30 * 3);
      // North road at (15, 2)
      const idx = (2 * 30 + 15) * 3;
      pixels[idx] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;

      const anchor = resolveIslandAnchor(
        "north_island",
        art,
        { x: 100, y: 100 },
        { x: 100, y: -400 },
        pixels
      );
      expect(anchor).toEqual({ x: 15, y: 2 });
    });
  });

  describe("computeWorldLayout", () => {
    const islands = [
      { id: "home", at: { x: 0, y: 0 } },
      { id: "khidmty", at: { x: 0, y: -90 } },
      { id: "civicmind", at: { x: 86, y: -28 } },
      { id: "onyx", at: { x: 53, y: 73 } },
      { id: "saleh", at: { x: -53, y: 73 } },
      { id: "eyad", at: { x: -86, y: -28 } },
    ];

    const sizes = {
      home: { w: 800, h: 1134 },
      khidmty: { w: 507, h: 692 },
      civicmind: { w: 537, h: 727 },
      onyx: { w: 521, h: 664 },
      saleh: { w: 542, h: 725 },
      eyad: { w: 534, h: 613 },
    };

    it("places all 6 islands with LAYOUT_SCALE = 0.63 and positive bounds", () => {
      const layout = computeWorldLayout(islands, sizes, 0.63, 600);

      expect(layout.islands.size).toBe(6);
      expect(layout.bounds.width).toBeGreaterThan(3000);
      expect(layout.bounds.height).toBeGreaterThan(3000);

      const home = layout.islands.get("home");
      expect(home).toBeDefined();
      expect(home!.centerX).toBe(layout.origin.x);
      expect(home!.centerY).toBe(layout.origin.y);

      // Verify all islands fit strictly inside layout bounds with margin
      for (const isl of layout.islands.values()) {
        expect(isl.worldX).toBeGreaterThanOrEqual(layout.bounds.minX);
        expect(isl.worldY).toBeGreaterThanOrEqual(layout.bounds.minY);
        expect(isl.worldX + isl.width).toBeLessThanOrEqual(layout.bounds.maxX);
        expect(isl.worldY + isl.height).toBeLessThanOrEqual(layout.bounds.maxY);
      }
    });

    it("ensures bridge spans between island anchors are in playable range", () => {
      const layout = computeWorldLayout(islands, sizes, 0.63, 600);
      const home = layout.islands.get("home")!;

      for (const islId of ["khidmty", "civicmind", "onyx", "saleh", "eyad"]) {
        const target = layout.islands.get(islId)!;
        const centerDist = Math.hypot(
          target.centerX - home.centerX,
          target.centerY - home.centerY
        );
        // Center distances should be between 700px and 1000px
        expect(centerDist).toBeGreaterThan(700);
        expect(centerDist).toBeLessThan(1000);
      }
    });

    it("verifies no bounding box or footprint overlaps exist in the computed layout", () => {
      const layout = computeWorldLayout(islands, sizes, 0.63, 600);
      const { overlaps } = checkLayoutOverlap(layout.islands.values());
      expect(overlaps).toEqual([]);
    });
  });
});

