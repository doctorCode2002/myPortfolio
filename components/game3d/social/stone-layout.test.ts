import { describe, expect, it } from "vitest";

import type { IslandWalkGrid, WalkCell } from "../logic/walk-grid";
import { pickStoneCell } from "./stone-layout";

const cell = (
  q: number,
  r: number,
  over: Partial<WalkCell> = {}
): WalkCell => ({
  q,
  r,
  level: 0,
  y: 0,
  x: q * 2,
  z: r * 2,
  tile: "hex-grass",
  water: false,
  ground: true,
  blocked: false,
  ...over,
});

const grid = (cells: WalkCell[], obstacles: IslandWalkGrid["obstacles"] = []) =>
  ({
    cells: new Map(cells.map((c) => [`${c.q},${c.r}`, c])),
    obstacles,
  }) as unknown as IslandWalkGrid;

describe("pickStoneCell", () => {
  it("takes the first free, flat, walkable hex", () => {
    const g = grid(
      [cell(3, 0, { blocked: true }), cell(0, -2), cell(2, -3)],
      [{ shape: "circle", x: 0, z: -4, radius: 0.3, source: "rock" }]
    );
    expect(pickStoneCell(g)).toMatchObject({ q: 2, r: -3 });
  });

  it("returns null when nothing fits", () => {
    expect(pickStoneCell(grid([cell(3, 0, { water: true })]))).toBeNull();
  });
});
