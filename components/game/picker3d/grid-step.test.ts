import { describe, expect, it } from "vitest";

import { gridStep } from "./use-picker-controls";

describe("gridStep", () => {
  it("moves along a 3-column grid and wraps", () => {
    expect(gridStep("ArrowRight", 0, 6, 3, false)).toBe(1);
    expect(gridStep("ArrowLeft", 0, 6, 3, false)).toBe(5);
    expect(gridStep("ArrowDown", 1, 6, 3, false)).toBe(4);
    expect(gridStep("ArrowUp", 1, 6, 3, false)).toBe(4);
  });

  it("uses the phone's 2 columns for up and down", () => {
    expect(gridStep("ArrowDown", 0, 6, 2, false)).toBe(2);
    expect(gridStep("ArrowUp", 0, 6, 2, false)).toBe(4);
  });

  it("mirrors left and right in RTL", () => {
    expect(gridStep("ArrowLeft", 0, 6, 3, true)).toBe(1);
    expect(gridStep("ArrowRight", 0, 6, 3, true)).toBe(5);
  });

  it("ignores other keys", () => {
    expect(gridStep("Enter", 0, 6, 3, false)).toBeNull();
  });
});
