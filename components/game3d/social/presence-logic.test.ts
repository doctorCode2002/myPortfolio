import { describe, expect, it } from "vitest";

import {
  createGhost,
  ghostAlpha,
  ghostExpired,
  lerpAngle,
  pushSample,
  sampleGhost,
  sanitizeWire,
  selectNearest,
  shouldSend,
  toWire,
  type GhostPose,
  type GhostState,
  type Pose,
  type WirePos,
} from "./presence-logic";

const wire = (over: Partial<WirePos> = {}): WirePos => ({
  id: "abcd-1234",
  char: "char_2",
  island: "home",
  x: 0,
  y: 1,
  z: 0,
  heading: 0,
  mode: "walk",
  t: 1,
  ...over,
});

const pose = (over: Partial<Pose> = {}): Pose => ({
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  island: "home",
  mode: "walk",
  char: "char_0",
  ...over,
});

const out = (): GhostPose => ({ x: 0, y: 0, z: 0, h: 0, speed: 0 });

describe("ghost interpolation", () => {
  it("interpolates between bracketing samples and reports speed", () => {
    const g = createGhost(wire({ x: 0, t: 1 }), 1000);
    pushSample(g, wire({ x: 1, t: 2 }), 1250);
    const o = sampleGhost(g, 1125, out());
    expect(o.x).toBeCloseTo(0.5);
    expect(o.y).toBeCloseTo(1);
    expect(o.speed).toBeCloseTo(4); // 1 m in 0.25 s
  });

  it("holds the ends outside the buffer", () => {
    const g = createGhost(wire({ x: 2, t: 1 }), 1000);
    pushSample(g, wire({ x: 4, t: 2 }), 1250);
    expect(sampleGhost(g, 500, out()).x).toBe(2);
    const late = sampleGhost(g, 5000, out());
    expect(late.x).toBe(4);
    expect(late.speed).toBe(0);
  });

  it("turns the short way round", () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
    const g = createGhost(wire({ heading: 3, t: 1 }), 0);
    pushSample(g, wire({ heading: -3, t: 2 }), 100);
    expect(Math.abs(sampleGhost(g, 50, out()).h)).toBeGreaterThan(3);
  });

  it("drops out-of-order packets and caps the buffer", () => {
    const g = createGhost(wire({ t: 10 }), 0);
    expect(pushSample(g, wire({ x: 9, t: 5 }), 10)).toBe(false);
    for (let i = 0; i < 20; i++)
      pushSample(g, wire({ x: i * 0.1, t: 11 + i }), 20 + i * 250);
    expect(g.samples.length).toBeLessThanOrEqual(6);
  });

  it("snaps on teleports instead of sliding across the sky", () => {
    const g = createGhost(wire({ x: 0, t: 1 }), 0);
    pushSample(g, wire({ x: 100, t: 2 }), 250);
    expect(g.samples).toHaveLength(1);
    expect(sampleGhost(g, 100, out()).x).toBe(100);
  });
});

describe("fade and staleness", () => {
  it("stays solid for 15 s, then fades and expires", () => {
    expect(ghostAlpha(0)).toBe(1);
    expect(ghostAlpha(15000)).toBe(1);
    expect(ghostAlpha(15750)).toBeCloseTo(0.5);
    expect(ghostAlpha(20000)).toBe(0);
    expect(ghostExpired(15000)).toBe(false);
    expect(ghostExpired(16600)).toBe(true);
  });
});

describe("selectNearest", () => {
  const ghostAt = (id: string, x: number, lastSeen = 0): GhostState => {
    const g = createGhost(wire({ id, x }), lastSeen);
    return g;
  };

  it("keeps the 12 nearest, nearest first", () => {
    const list = Array.from({ length: 20 }, (_, i) =>
      ghostAt(`ghost-${String(i).padStart(2, "0")}`, 20 - i)
    );
    const ids = selectNearest(list, 0, 0, 0);
    expect(ids).toHaveLength(12);
    expect(ids[0]).toBe("ghost-19");
    expect(ids[11]).toBe("ghost-08");
  });

  it("skips expired ghosts", () => {
    const ids = selectNearest(
      [ghostAt("fresh-1", 5, 10000), ghostAt("stale-1", 1, 0)],
      0,
      0,
      17000
    );
    expect(ids).toEqual(["fresh-1"]);
  });
});

describe("shouldSend (throttle)", () => {
  it("sends the first pose immediately", () => {
    expect(shouldSend(null, 0, pose())).toBe(true);
  });

  it("limits moving updates to 4 Hz", () => {
    const last = { at: 1000, pose: pose() };
    const moved = pose({ x: 1 });
    expect(shouldSend(last, 1100, moved)).toBe(false);
    expect(shouldSend(last, 1250, moved)).toBe(true);
  });

  it("only heartbeats while idle", () => {
    const last = { at: 1000, pose: pose() };
    expect(shouldSend(last, 1300, pose())).toBe(false);
    expect(shouldSend(last, 5900, pose())).toBe(false);
    expect(shouldSend(last, 6000, pose())).toBe(true);
  });

  it("treats a mode or character change as movement", () => {
    const last = { at: 0, pose: pose() };
    expect(shouldSend(last, 300, pose({ mode: "drive" }))).toBe(true);
    expect(shouldSend(last, 300, pose({ char: "char_3" }))).toBe(true);
  });
});

describe("wire format", () => {
  it("rounds positions and round-trips through sanitize", () => {
    const w = toWire("abcd-1234", pose({ x: 1.23456, heading: 7 }), 99.6);
    expect(w.x).toBe(1.23);
    expect(w.t).toBe(100);
    expect(Math.abs(w.heading)).toBeLessThanOrEqual(Math.PI);
    expect(sanitizeWire(w)).toEqual(w);
  });

  it("rejects malformed or hostile payloads", () => {
    expect(sanitizeWire(null)).toBeNull();
    expect(sanitizeWire({ ...wire(), x: "1" })).toBeNull();
    expect(sanitizeWire({ ...wire(), x: Number.NaN })).toBeNull();
    expect(sanitizeWire({ ...wire(), x: 1e9 })).toBeNull();
    expect(sanitizeWire({ ...wire(), id: "<script>" })).toBeNull();
    const odd = sanitizeWire({
      ...wire(),
      char: "../evil",
      island: "x y",
      mode: "fly",
    });
    expect(odd).toMatchObject({ char: "char_0", island: null, mode: "walk" });
  });
});
