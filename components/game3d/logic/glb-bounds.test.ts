import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { glbBounds } from "./glb-bounds";

const read = (name: string): ArrayBuffer => {
  const b = readFileSync(`public/game3d/models/${name}.glb`);
  return b.buffer.slice(
    b.byteOffset,
    b.byteOffset + b.byteLength
  ) as ArrayBuffer;
};

describe("glb bounds", () => {
  it("finds a hex-edge fence on the hex's -x edge", () => {
    const b = glbBounds(read("fence-wood-straight"))!;
    expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(-1, 1);
    expect(b.max[2] - b.min[2]).toBeCloseTo(1.16, 1);
  });

  it("reads a quantized hex tile as 2 wide with its top at 0", () => {
    const b = glbBounds(read("hex-grass"))!;
    expect(b.max[0] - b.min[0]).toBeCloseTo(2, 1);
    expect(b.max[1]).toBeCloseTo(0, 1);
  });
});
