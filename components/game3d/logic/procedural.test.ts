import { describe, expect, it } from "vitest";

import { buildBridgeBoxes } from "./bridge-layout";
import {
  CAMERA,
  cameraRelative,
  clampPitch,
  clampYaw,
  stepZoom,
  zoomToDistance,
} from "./camera-math";
import { circumradiusFromWidth, hexSpiral, hexToWorld } from "./hex";
import { createRng, valueNoise2 } from "./noise";
import { buildUnderside, outlineProfile } from "./underside";
import { buildWalkWorld } from "./walk-world";
import type { Island3D } from "./types";

const R = circumradiusFromWidth(2);

describe("noise", () => {
  it("is deterministic and bounded", () => {
    const a = createRng(5);
    const b = createRng(5);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
    for (let i = 0; i < 50; i++) {
      const v = valueNoise2(i * 0.37, i * 0.11, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("underside", () => {
  const centres = hexSpiral({ q: 0, r: 0 }, 3).map((h) =>
    hexToWorld(h.q, h.r, R)
  );

  it("fits a profile that covers every hex centre", () => {
    const { profile } = outlineProfile(centres, R, 36);
    expect(profile.every((p) => p > 0)).toBe(true);
    expect(Math.min(...profile)).toBeGreaterThan(3 * 2 * 0.8);
  });

  it("builds whole triangles with colours, hanging below the top and with roots", () => {
    const u = buildUnderside(centres, R, { depth: 6, seed: 2 });
    expect(u.positions.length % 9).toBe(0);
    expect(u.colors.length).toBe(u.positions.length);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < u.positions.length; i += 3) {
      minY = Math.min(minY, u.positions[i]!);
      maxY = Math.max(maxY, u.positions[i]!);
    }
    expect(maxY).toBeLessThanOrEqual(0.1);
    expect(minY).toBeLessThan(-5.5);
    expect(u.roots.length).toBeGreaterThan(0);
    // At least two distinct colour bands.
    const reds = new Set<number>();
    for (let i = 0; i < u.colors.length; i += 9)
      reds.add(Math.round(u.colors[i]! * 10));
    expect(reds.size).toBeGreaterThan(1);
  });
});

describe("bridge layout", () => {
  const disc = (
    id: string,
    c: [number, number],
    anchor: [number, number],
    to: string
  ): Island3D => ({
    id,
    center: c,
    hexes: hexSpiral({ q: 0, r: 0 }, 2).map((h) => ({
      ...h,
      tile: "hex-grass",
    })),
    anchors: [{ id: `to_${to}`, q: anchor[0], r: anchor[1] }],
  });
  const world = buildWalkWorld(
    [disc("a", [0, 0], [0, -2], "b"), disc("b", [0, -18], [0, 2], "a")],
    [{ from: "a", to: "b", style: "rope" }]
  );

  for (const style of ["rope", "stone"] as const) {
    it(`builds a ${style} deck with only along/across pieces (no X bracing)`, () => {
      const br = { ...world.bridges[0]!, style };
      const boxes = buildBridgeBoxes(br, 2);
      expect(boxes.length).toBeGreaterThan(10);
      const yaw = Math.atan2(br.b.x - br.a.x, br.b.z - br.a.z);
      for (const b of boxes) {
        // Every piece is aligned with the bridge heading (planks jitter a few degrees).
        expect(Math.abs(b.yaw - yaw)).toBeLessThan(0.05);
        expect(b.t).toBeGreaterThanOrEqual(0);
        expect(b.t).toBeLessThanOrEqual(1);
      }
    });
  }
});

describe("camera math", () => {
  it("clamps yaw to ±60° and pitch to 30-65°", () => {
    expect(clampYaw(2)).toBeCloseTo(CAMERA.yawLimit);
    expect(clampYaw(-2)).toBeCloseTo(-CAMERA.yawLimit);
    expect(clampPitch(0)).toBeCloseTo((30 * Math.PI) / 180);
    expect(clampPitch(2)).toBeCloseTo((65 * Math.PI) / 180);
  });

  it("steps zoom through the levels and maps zoom to distance", () => {
    expect(stepZoom(2, 1)).toBe(3);
    expect(stepZoom(2, -1)).toBe(1.5);
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(2.2, -1)).toBe(2);
    expect(zoomToDistance(2)).toBeCloseTo(CAMERA.baseDistance / 2);
  });

  it("maps forward input to the camera heading", () => {
    const f = cameraRelative(0, 1, 0);
    expect(f.x).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(-1);
    const r = cameraRelative(1, 0, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.z).toBeCloseTo(-1);
  });
});
