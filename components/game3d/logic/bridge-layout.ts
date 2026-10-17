/**
 * Generated bridge parts as oriented boxes: plank decks with posts and parallel rails
 * (rope style) or block decks with parapets (stone style). Everything runs along or across
 * the deck; there are no diagonal braces, so no X shapes. Pure: no three or react imports.
 */

import { createRng, seedFromString } from "./noise";
import { bridgeHeightAt, type BridgeCorridor } from "./walk-world";

export type BridgeBox = {
  /** Centre (world). */
  x: number;
  y: number;
  z: number;
  /** Size: across the deck, height, along the deck. */
  sx: number;
  sy: number;
  sz: number;
  /** Rotation around y so local +z runs along the bridge, and pitch around local x. */
  yaw: number;
  pitch: number;
  color: [number, number, number];
  /** Position along the bridge (0..1) for the bob blend between the two islands. */
  t: number;
};

const WOOD: [number, number, number][] = [
  [0.55, 0.37, 0.22],
  [0.6, 0.41, 0.25],
  [0.5, 0.33, 0.2],
];
const ROPE: [number, number, number] = [0.42, 0.33, 0.22];
const STONE: [number, number, number][] = [
  [0.66, 0.64, 0.6],
  [0.6, 0.58, 0.55],
  [0.7, 0.68, 0.63],
];

function pick<T>(arr: readonly T[], r: number): T {
  return arr[Math.floor(r * arr.length) % arr.length] as T;
}

export function buildBridgeBoxes(
  bridge: BridgeCorridor,
  hexWidth: number
): BridgeBox[] {
  const rng = createRng(seedFromString(bridge.id));
  const dx = bridge.b.x - bridge.a.x;
  const dz = bridge.b.z - bridge.a.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  // Across-deck unit vector (to the right of the travel direction).
  const vx = -uz;
  const vz = ux;
  const yaw = Math.atan2(ux, uz);
  // Start and end the deck around the anchors' outer edges (the landing overlaps the hex).
  const t0 = Math.min(0.45, (hexWidth * 0.2) / len);
  const t1 = 1 - t0;
  const half = bridge.halfWidth + 0.05;
  const boxes: BridgeBox[] = [];

  const at = (
    t: number,
    side: number,
    lift: number
  ): { x: number; y: number; z: number } => ({
    x: bridge.a.x + dx * t + vx * side,
    y: bridgeHeightAt(bridge, t) + lift,
    z: bridge.a.z + dz * t + vz * side,
  });
  const pitchAt = (t: number): number => {
    const e = 0.01;
    const dy = bridgeHeightAt(bridge, t + e) - bridgeHeightAt(bridge, t - e);
    return -Math.atan2(dy, 2 * e * len);
  };
  /** A box spanning from t=ta to t=tb along the bridge at a side offset. */
  const span = (
    ta: number,
    tb: number,
    side: number,
    lift: number,
    sx: number,
    sy: number,
    color: [number, number, number]
  ): void => {
    const p = at((ta + tb) / 2, side, lift);
    const pa = at(ta, side, lift);
    const pb = at(tb, side, lift);
    const segLen = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z);
    boxes.push({
      ...p,
      sx,
      sy,
      sz: segLen + 0.02,
      yaw,
      pitch: -Math.atan2(pb.y - pa.y, Math.hypot(pb.x - pa.x, pb.z - pa.z)),
      color,
      t: (ta + tb) / 2,
    });
  };

  const usable = (t1 - t0) * len;
  if (bridge.style === "stone") {
    const blockLen = 0.55;
    const n = Math.max(2, Math.round(usable / blockLen));
    for (let i = 0; i < n; i++) {
      const ta = t0 + ((t1 - t0) * i) / n;
      const tb = t0 + ((t1 - t0) * (i + 1)) / n;
      // Deck slab (thick, so the deck reads as masonry from below).
      span(ta, tb, 0, -0.2, half * 2, 0.4, pick(STONE, rng()));
      // Parapets: low walls on both edges.
      for (const side of [-1, 1]) {
        span(ta, tb, side * (half - 0.1), 0.18, 0.22, 0.36, pick(STONE, rng()));
      }
    }
    // Pillars every few metres on the parapets.
    const pillars = Math.max(2, Math.round(usable / 2.4) + 1);
    for (let i = 0; i < pillars; i++) {
      const t = t0 + ((t1 - t0) * i) / (pillars - 1);
      for (const side of [-1, 1]) {
        const p = at(t, side * (half - 0.1), 0.3);
        boxes.push({
          ...p,
          sx: 0.32,
          sy: 0.6,
          sz: 0.32,
          yaw,
          pitch: 0,
          color: pick(STONE, rng()),
          t,
        });
      }
    }
    // A keel under the deck that thickens towards mid-span (an arch silhouette).
    const keel = Math.max(2, Math.round(usable / 1.2));
    for (let i = 0; i < keel; i++) {
      const ta = t0 + ((t1 - t0) * i) / keel;
      const tb = t0 + ((t1 - t0) * (i + 1)) / keel;
      const mid = (ta + tb) / 2;
      const depthK = 0.25 + 0.35 * (1 - Math.abs(mid - 0.5) * 2);
      span(
        ta,
        tb,
        0,
        -0.4 - depthK / 2,
        half * 1.4,
        depthK,
        pick(STONE, rng())
      );
    }
    return boxes;
  }

  // Rope style: planks across, two stringers along, posts and parallel rails.
  const plankPitch = 0.3;
  const n = Math.max(2, Math.round(usable / plankPitch));
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const p = at(t, (rng() - 0.5) * 0.06, -0.04);
    boxes.push({
      ...p,
      sx: half * 2 + (rng() - 0.5) * 0.1,
      sy: 0.07,
      sz: 0.24,
      yaw: yaw + (rng() - 0.5) * 0.06,
      pitch: pitchAt(t),
      color: pick(WOOD, rng()),
      t,
    });
  }
  const segs = Math.max(2, Math.round(usable / 0.8));
  for (let i = 0; i < segs; i++) {
    const ta = t0 + ((t1 - t0) * i) / segs;
    const tb = t0 + ((t1 - t0) * (i + 1)) / segs;
    for (const side of [-1, 1]) {
      span(
        ta,
        tb,
        side * (half - 0.12),
        -0.13,
        0.1,
        0.1,
        WOOD[2] as [number, number, number]
      );
      // Rail rope at hand height, and a lower guide rope (both parallel to the deck).
      span(ta, tb, side * (half - 0.02), 0.72, 0.05, 0.05, ROPE);
      span(ta, tb, side * (half - 0.02), 0.36, 0.04, 0.04, ROPE);
    }
  }
  const posts = Math.max(2, Math.round(usable / 1.5) + 1);
  for (let i = 0; i < posts; i++) {
    const t = t0 + ((t1 - t0) * i) / (posts - 1);
    for (const side of [-1, 1]) {
      const p = at(t, side * (half - 0.02), 0.36);
      boxes.push({
        ...p,
        sx: 0.09,
        sy: 0.84,
        sz: 0.09,
        yaw,
        pitch: 0,
        color: WOOD[0] as [number, number, number],
        t,
      });
    }
  }
  return boxes;
}
