/**
 * Illustrated Island Art metadata types and validator.
 *
 * Implements the contract defined in `docs/ISLAND_ART_SPEC.md`.
 * All coordinates are in the processed island's native pixel space,
 * with origin at top-left.
 */

import { ISLANDS } from "./world";

export type Point = [number, number];

export type OccluderRect = [x: number, y: number, w: number, h: number];

export type Occluder = {
  id: string;
  rect: OccluderRect;
  /** Player feet Y coordinate below which the occluder is drawn above the player. */
  baseY: number;
};

export type Door = {
  buildingId: string;
  at: Point;
  radius: number;
};

export type Anchor = {
  id: string;
  at: Point;
};

export type IslandArt = {
  version: 1;
  /** Native image size in pixels. */
  size: { w: number; h: number };
  /** Polygons the player's feet may be inside (top surface + walkable paths). */
  walkable: Array<Array<Point>>;
  /** Obstacle polygons inside walkable that block movement (walls, rocks, trees). */
  blockers: Array<Array<Point>>;
  /** Regions drawn above the player when player feet Y < baseY (roofs, tree canopies). */
  occluders: Array<Occluder>;
  /** Interactive door triggers. buildingId corresponds to entries in `lib/content/world.ts`. */
  doors: Array<Door>;
  /** Spawn positions for player and mayor. */
  spawns: {
    player?: Point;
    mayor?: Point;
  };
  /** Bridge attachment coordinates on the island boundary. */
  anchors: Array<Anchor>;
};

export type ValidateIslandArtOptions = {
  validBuildingIds?: readonly string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPoint(v: unknown): v is Point {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number"
  );
}

function isPointInBounds(pt: Point, w: number, h: number): boolean {
  return pt[0] >= 0 && pt[0] <= w && pt[1] >= 0 && pt[1] <= h;
}

/**
 * Validates an IslandArt metadata object against the specification.
 * Checks version, dimensions, polygon closure, boundary containment,
 * door building ID references in world.ts, and anchor uniqueness.
 *
 * Returns an array of error messages (empty if valid).
 */
export function validateIslandArt(
  json: unknown,
  options?: ValidateIslandArtOptions
): string[] {
  const errors: string[] = [];

  if (!isRecord(json)) {
    return ["Island art metadata must be a JSON object"];
  }

  // 1. Version
  if (json["version"] !== 1) {
    errors.push(
      `Invalid version: expected 1, found ${String(json["version"])}`
    );
  }

  // 2. Size
  const size = json["size"];
  if (!isRecord(size)) {
    errors.push('Missing or invalid "size" object');
  } else {
    if (typeof size["w"] !== "number" || size["w"] <= 0) {
      errors.push(
        `Invalid width: expected positive number, found ${String(size["w"])}`
      );
    }
    if (typeof size["h"] !== "number" || size["h"] <= 0) {
      errors.push(
        `Invalid height: expected positive number, found ${String(size["h"])}`
      );
    }
  }

  const w = isRecord(size) && typeof size["w"] === "number" ? size["w"] : 0;
  const h = isRecord(size) && typeof size["h"] === "number" ? size["h"] : 0;

  // Helper for polygon lists (walkable, blockers)
  const validatePolygons = (
    polys: unknown,
    field: "walkable" | "blockers"
  ): void => {
    if (!Array.isArray(polys)) {
      errors.push(`"${field}" must be an array of polygons`);
      return;
    }

    polys.forEach((poly, polyIdx) => {
      if (!Array.isArray(poly)) {
        errors.push(`${field}[${polyIdx}] must be an array of points`);
        return;
      }

      if (poly.length < 4) {
        errors.push(
          `${field}[${polyIdx}] must have at least 4 points to form a closed polygon (found ${poly.length})`
        );
        return;
      }

      // Check points are valid and inside size
      for (let i = 0; i < poly.length; i++) {
        const pt = poly[i];
        if (!isPoint(pt)) {
          errors.push(`${field}[${polyIdx}][${i}] must be a [x, y] point`);
        } else if (w > 0 && h > 0 && !isPointInBounds(pt, w, h)) {
          errors.push(
            `${field}[${polyIdx}][${i}] ([${pt[0]}, ${pt[1]}]) is outside island size (${w}x${h})`
          );
        }
      }

      // Check polygon is closed (first point matches last point)
      const first = poly[0];
      const last = poly[poly.length - 1];
      if (isPoint(first) && isPoint(last)) {
        if (first[0] !== last[0] || first[1] !== last[1]) {
          errors.push(
            `${field}[${polyIdx}] is not closed: first point [${first[0]}, ${first[1]}] does not match last point [${last[0]}, ${last[1]}]`
          );
        }
      }
    });
  };

  validatePolygons(json["walkable"], "walkable");
  validatePolygons(json["blockers"], "blockers");

  // 3. Occluders
  const occluders = json["occluders"];
  if (!Array.isArray(occluders)) {
    errors.push('"occluders" must be an array');
  } else {
    const seenOccluderIds = new Set<string>();
    occluders.forEach((occ, idx) => {
      if (!isRecord(occ)) {
        errors.push(`occluders[${idx}] must be an object`);
        return;
      }
      if (typeof occ["id"] !== "string" || occ["id"].trim().length === 0) {
        errors.push(`occluders[${idx}] missing valid id`);
      } else {
        if (seenOccluderIds.has(occ["id"])) {
          errors.push(`Duplicate occluder id: "${occ["id"]}"`);
        }
        seenOccluderIds.add(occ["id"]);
      }

      const rect = occ["rect"];
      if (
        !Array.isArray(rect) ||
        rect.length !== 4 ||
        !rect.every((n) => typeof n === "number")
      ) {
        errors.push(`occluders[${idx}] "rect" must be [x, y, w, h]`);
      } else if (w > 0 && h > 0) {
        const [rx, ry, rw, rh] = rect as [number, number, number, number];
        if (
          rx < 0 ||
          ry < 0 ||
          rw <= 0 ||
          rh <= 0 ||
          rx + rw > w ||
          ry + rh > h
        ) {
          errors.push(
            `occluders[${idx}] rect [${rx}, ${ry}, ${rw}, ${rh}] exceeds island bounds (${w}x${h})`
          );
        }
      }

      if (
        typeof occ["baseY"] !== "number" ||
        (h > 0 && (occ["baseY"] < 0 || occ["baseY"] > h))
      ) {
        errors.push(
          `occluders[${idx}] "baseY" must be a number within [0, ${h}]`
        );
      }
    });
  }

  // 4. Doors
  const doors = json["doors"];
  const validBuildingIds = new Set(
    options?.validBuildingIds ??
      ISLANDS.flatMap((i) => i.buildings.map((b) => b.id))
  );

  if (!Array.isArray(doors)) {
    errors.push('"doors" must be an array');
  } else {
    doors.forEach((door, idx) => {
      if (!isRecord(door)) {
        errors.push(`doors[${idx}] must be an object`);
        return;
      }
      if (typeof door["buildingId"] !== "string") {
        errors.push(`doors[${idx}] missing buildingId`);
      } else if (!validBuildingIds.has(door["buildingId"])) {
        errors.push(
          `doors[${idx}] references unknown buildingId: "${door["buildingId"]}"`
        );
      }

      const at = door["at"];
      if (!isPoint(at)) {
        errors.push(`doors[${idx}] "at" must be a [x, y] point`);
      } else if (w > 0 && h > 0 && !isPointInBounds(at, w, h)) {
        errors.push(
          `doors[${idx}] "at" ([${at[0]}, ${at[1]}]) is outside island bounds`
        );
      }

      if (typeof door["radius"] !== "number" || door["radius"] <= 0) {
        errors.push(`doors[${idx}] "radius" must be a positive number`);
      }
    });
  }

  // 5. Spawns
  const spawns = json["spawns"];
  if (!isRecord(spawns)) {
    errors.push('"spawns" must be an object');
  } else {
    if (spawns["player"] !== undefined) {
      if (!isPoint(spawns["player"])) {
        errors.push('"spawns.player" must be a [x, y] point');
      } else if (w > 0 && h > 0 && !isPointInBounds(spawns["player"], w, h)) {
        errors.push('"spawns.player" is outside island bounds');
      }
    }
    if (spawns["mayor"] !== undefined) {
      if (!isPoint(spawns["mayor"])) {
        errors.push('"spawns.mayor" must be a [x, y] point');
      } else if (w > 0 && h > 0 && !isPointInBounds(spawns["mayor"], w, h)) {
        errors.push('"spawns.mayor" is outside island bounds');
      }
    }
  }

  // 6. Anchors
  const anchors = json["anchors"];
  if (!Array.isArray(anchors)) {
    errors.push('"anchors" must be an array');
  } else {
    const seenAnchorIds = new Set<string>();
    anchors.forEach((anc, idx) => {
      if (!isRecord(anc)) {
        errors.push(`anchors[${idx}] must be an object`);
        return;
      }
      if (typeof anc["id"] !== "string" || anc["id"].trim().length === 0) {
        errors.push(`anchors[${idx}] missing id`);
      } else {
        if (seenAnchorIds.has(anc["id"])) {
          errors.push(`Duplicate anchor id: "${anc["id"]}"`);
        }
        seenAnchorIds.add(anc["id"]);
      }

      const at = anc["at"];
      if (!isPoint(at)) {
        errors.push(`anchors[${idx}] "at" must be a [x, y] point`);
      } else if (w > 0 && h > 0 && !isPointInBounds(at, w, h)) {
        errors.push(
          `anchors[${idx}] "at" ([${at[0]}, ${at[1]}]) is outside island bounds`
        );
      }
    });
  }

  return errors;
}
