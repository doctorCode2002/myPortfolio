import { describe, expect, it } from "vitest";

import {
  HEX_DIRECTIONS,
  SQRT3,
  circumradiusFromWidth,
  hexCorners,
  hexDistance,
  hexKey,
  hexNeighbours,
  hexRing,
  hexRound,
  hexSpiral,
  hexToWorld,
  parseHexKey,
  pointInHex,
  worldToHex,
} from "./hex";

const R = circumradiusFromWidth(2);

describe("hex math (pointy-top axial)", () => {
  it("places the origin at the origin and neighbours one width apart", () => {
    expect(hexToWorld(0, 0, R)).toEqual({ x: 0, z: 0 });
    for (const d of HEX_DIRECTIONS) {
      const p = hexToWorld(d.q, d.r, R);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(2, 6);
    }
  });

  it("uses the pointy-top layout (east neighbour on +x, rows 1.5R apart)", () => {
    expect(hexToWorld(1, 0, R).x).toBeCloseTo(SQRT3 * R);
    expect(hexToWorld(1, 0, R).z).toBeCloseTo(0);
    expect(hexToWorld(0, 1, R).z).toBeCloseTo(1.5 * R);
    expect(hexToWorld(0, 1, R).x).toBeCloseTo((SQRT3 * R) / 2);
  });

  it("round-trips hex -> world -> hex", () => {
    for (const h of hexSpiral({ q: 0, r: 0 }, 6)) {
      const p = hexToWorld(h.q, h.r, R);
      expect(worldToHex(p.x, p.z, R)).toEqual(h);
    }
  });

  it("maps points near a corner to one of the touching hexes and inside points to their hex", () => {
    const c = hexCorners(2, -1, R);
    const centre = hexToWorld(2, -1, R);
    for (const p of c) {
      const inner = {
        x: centre.x + (p.x - centre.x) * 0.95,
        z: centre.z + (p.z - centre.z) * 0.95,
      };
      expect(pointInHex(inner.x, inner.z, 2, -1, R)).toBe(true);
    }
  });

  it("rounds fractional coordinates and normalises -0", () => {
    expect(hexRound(0.1, -0.1)).toEqual({ q: 0, r: 0 });
    expect(Object.is(hexRound(-0.2, 0.1).q, -0)).toBe(false);
    expect(hexRound(0.9, 0.8)).toEqual({ q: 1, r: 1 });
    expect(hexRound(0.6, 0.6)).toEqual({ q: 1, r: 0 });
  });

  it("lists six distinct neighbours at distance 1", () => {
    const n = hexNeighbours(3, -2);
    expect(new Set(n.map((h) => hexKey(h.q, h.r))).size).toBe(6);
    for (const h of n) expect(hexDistance(h, { q: 3, r: -2 })).toBe(1);
  });

  it("builds rings of 6k hexes at exact distance k and spirals of 3k(k+1)+1", () => {
    for (let k = 0; k <= 5; k++) {
      const ring = hexRing({ q: 1, r: 1 }, k);
      expect(ring.length).toBe(k === 0 ? 1 : 6 * k);
      for (const h of ring) expect(hexDistance(h, { q: 1, r: 1 })).toBe(k);
      expect(new Set(ring.map((h) => hexKey(h.q, h.r))).size).toBe(ring.length);
      expect(hexSpiral({ q: 0, r: 0 }, k).length).toBe(3 * k * (k + 1) + 1);
    }
  });

  it("parses keys back", () => {
    expect(parseHexKey(hexKey(-3, 4))).toEqual({ q: -3, r: 4 });
  });
});
