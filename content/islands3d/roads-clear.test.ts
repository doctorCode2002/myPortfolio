/**
 * No solid object stands on a road ribbon: every object that blocks walking (or the car)
 * sits at least half the road width from every road centre line. Ground decals, flat
 * props, soft decor the car drives through (flowers, grass) and bridge decks are exempt;
 * walk-through props like banners still count.
 */

import { describe, expect, it } from "vitest";

import { objectCollision } from "@/components/game3d/logic/catalog";
import { readModelBoundsFromDisk } from "@/components/game3d/logic/bounds.node";
import { hexKey } from "@/components/game3d/logic/hex";
import {
  ROAD_WIDTH,
  buildRoadNetwork,
  distanceToRoad,
} from "@/components/game3d/logic/roads";
import {
  buildIslandWalkGrid,
  collisionObstacle,
} from "@/components/game3d/logic/walk-grid";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";

import { ISLANDS_3D } from "./index";

/** Decor the car drives through (as in world-layout's breakable props). */
const SOFT_DECOR =
  /flower|grass|lily|waterplant|blooms|decal|crop|leafs|petal/i;

const manifest = readManifestFromDisk();
const bounds = readModelBoundsFromDisk(ISLANDS_3D, manifest);

describe.each(ISLANDS_3D.map((i) => [i.id, i] as const))(
  "island %s roads",
  (_id, island) => {
    it("keeps every solid object off the road ribbons", () => {
      const grid = buildIslandWalkGrid(island, { manifest });
      const net = buildRoadNetwork(island, grid, {
        heightJitter: island.heightJitter ?? 0,
      });
      const bad: string[] = [];
      for (const obj of island.objects ?? []) {
        const tags = manifest.models[obj.model]?.tags ?? [];
        if (SOFT_DECOR.test([obj.model, ...tags].join(" "))) continue;
        // Props marked walk-through (banners, low fences) still stand in the car's way.
        const col = objectCollision(
          { ...obj, solid: true },
          manifest,
          grid.hexWidth,
          bounds[obj.model] ?? null
        );
        if (col.type !== "box" && col.type !== "circle") continue;
        const cell = grid.cells.get(hexKey(obj.q, obj.r));
        if (!cell) continue;
        // The collider's centre (hex-edge pieces sit off their origin).
        const o = collisionObstacle(
          col,
          obj,
          cell.x + (obj.offset?.[0] ?? 0),
          cell.z + (obj.offset?.[1] ?? 0),
          ""
        );
        if (!o) continue;
        const d = distanceToRoad(net, o.x, o.z);
        if (d < ROAD_WIDTH / 2)
          bad.push(`${obj.model}@${obj.q},${obj.r} d=${d.toFixed(2)}`);
      }
      expect(bad).toEqual([]);
    });
  }
);
