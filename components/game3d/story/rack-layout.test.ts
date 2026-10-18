import { describe, expect, it } from "vitest";

import { STACK_CHIPS } from "@/lib/content/about";
import { rackSlots } from "./rack-layout";

describe("rackSlots", () => {
  it("gives every technology its own slot between the posts", () => {
    const slots = rackSlots(STACK_CHIPS.length, [0.42, 0.92], 0.86);
    expect(slots).toHaveLength(STACK_CHIPS.length);
    const xs = slots.map((s) => s.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    for (const s of slots) expect(Math.abs(s.x)).toBeLessThan(0.86 - 0.1);
  });

  it("alternates shelves, top first, keeping same-shelf neighbours apart", () => {
    const slots = rackSlots(11, [0.42, 0.92], 0.86);
    expect(slots[0]?.y).toBe(0.92);
    expect(slots[1]?.y).toBe(0.42);
    const top = slots.filter((s) => s.y === 0.92);
    for (let i = 1; i < top.length; i++)
      expect((top[i]?.x ?? 0) - (top[i - 1]?.x ?? 0)).toBeGreaterThan(0.24);
  });
});
