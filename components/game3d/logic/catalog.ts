/**
 * Classification of tiles and objects for walking, from the manifest when it lists the
 * model, or from the model name when it does not (so islands work before the manifest
 * exists). Pure: no three or react imports.
 */

import type { IslandObject, Manifest, ManifestModel } from "./types";

const NON_WALKABLE_TILE =
  /water|river|lake|ocean|pond|void|mountain|cliff|lava/i;
const WALKABLE_TILE =
  /grass|path|road|sand|bridge|stone|dirt|plain|field|ground|floor|snow|ramp|stair/i;
const WATER_TILE = /water|river|lake|ocean|pond/i;

export function getModel(
  manifest: Manifest | null | undefined,
  name: string
): ManifestModel | undefined {
  return manifest?.models[name];
}

/** True when the model exists and is not banned. Loaders refuse banned models. */
export function isUsableModel(
  manifest: Manifest | null | undefined,
  name: string
): boolean {
  const m = getModel(manifest, name);
  return Boolean(m && !m.banned);
}

function nameAndTags(name: string, model: ManifestModel | undefined): string {
  return [name, ...(model?.tags ?? [])].join(" ");
}

export function isWaterTile(name: string, manifest?: Manifest | null): boolean {
  return WATER_TILE.test(nameAndTags(name, getModel(manifest, name)));
}

/** Whether a terrain tile can be walked on. Unknown tiles default to walkable. */
export function isTileWalkable(
  name: string,
  manifest?: Manifest | null
): boolean {
  const model = getModel(manifest, name);
  if (model?.walkable !== undefined) return model.walkable;
  const text = nameAndTags(name, model);
  if (NON_WALKABLE_TILE.test(text)) return false;
  if (WALKABLE_TILE.test(text)) return true;
  return true;
}

export type ObjectKind =
  "building" | "tree" | "rock" | "prop" | "flat" | "bridge";

const TREE =
  /tree|pine|palm|bush|shrub|plant|foliage|flower|grass-tuft|mushroom|cactus|reed|lily/i;
const ROCK = /rock|boulder|stone-big/i;
/** Name-only fallbacks for models the manifest does not list (never applied to tags). */
const BUILDING_NAME =
  /^(building|house|cottage|tower|castle|hall|shop|market|tavern|barn|mill|temple|library|school|portal|keep|warehouse|archive)/i;
const FLAT_NAME = /flat|decal|path|road|rug|carpet|crops?-|grass-patch/i;

/**
 * Category used for collision and fallback rendering. With a manifest entry the
 * manifest `kind` decides (building / terrain / bridge / nature / prop); tags only refine
 * nature into trees and rocks. Unknown models fall back to name patterns.
 */
export function objectKind(
  name: string,
  manifest?: Manifest | null
): ObjectKind {
  const model = getModel(manifest, name);
  if (model) {
    if (model.kind === "building") return "building";
    if (model.kind === "terrain" || model.overlay) return "flat";
    if (model.kind === "bridge") return "bridge";
    const text = nameAndTags(name, model);
    if (model.kind === "nature") {
      if (/tree|pine|palm|cactus/i.test(text)) return "tree";
      if (ROCK.test(text)) return "rock";
      if (TREE.test(text) && Math.max(...(model.footprint ?? [0.5, 0.5])) < 0.7)
        return "tree";
    }
    return "prop";
  }
  if (FLAT_NAME.test(name)) return "flat";
  if (BUILDING_NAME.test(name)) return "building";
  if (TREE.test(name)) return "tree";
  if (ROCK.test(name)) return "rock";
  return "prop";
}

/** Low decals (crop rows, rugs, path stones) that the grass skin must not cover. */
export function isGroundDecal(
  name: string,
  manifest?: Manifest | null
): boolean {
  const model = getModel(manifest, name);
  if (!model) return FLAT_NAME.test(name);
  if (model.kind === "bridge" || model.kind === "building") return false;
  const top = (model.minY ?? 0) + (model.size?.[1] ?? model.height ?? 1);
  return Boolean(model.overlay) || top < 0.16;
}

/** Models whose geometry is offset from their origin (hex-edge pieces): colliders need real bounds. */
export function needsBounds(name: string, manifest?: Manifest | null): boolean {
  const text = nameAndTags(name, getModel(manifest, name));
  return /hex-edge|fence|wall|hedge|gate/i.test(text);
}

/** Foliage materials get the wind-sway shader patch. */
export function isFoliage(name: string, manifest?: Manifest | null): boolean {
  const text = nameAndTags(name, getModel(manifest, name));
  return /tree|pine|palm|bush|shrub|plant|foliage|hedge|flower|grass/i.test(
    text
  );
}

/** Foliage whose colour is part of its identity (autumn, blossom) and must not be graded. */
export function isSeasonalFoliage(
  name: string,
  manifest?: Manifest | null
): boolean {
  const text = nameAndTags(name, getModel(manifest, name));
  return /autumn|fall|blossom|pink|spring|cherry|red|yellow|purple|flower|dead|snow/i.test(
    text
  );
}

export type ModelLocalBounds = {
  min: [number, number, number];
  max: [number, number, number];
};

export type ObjectCollision =
  | { type: "none" }
  /** A circle obstacle of `radius` metres around the object position. */
  | { type: "circle"; radius: number }
  /**
   * An oriented box obstacle: half extents in metres before the object's rotation, and
   * the box centre's offset from the object origin in the object's local frame (scaled).
   * `blockHex` also closes the object's own hex, so doors sit on a neighbouring hex.
   */
  | {
      type: "box";
      hx: number;
      hz: number;
      cx: number;
      cz: number;
      blockHex: boolean;
    }
  /** A walkable deck over its hex (bridge models): top height and half width across. */
  | { type: "deck"; top: number; halfWidth: number; halfLength: number };

/**
 * How an object blocks walking. Buildings close their own hex and add a box from their
 * measured size; trees are trunk circles; every other solid prop blocks only its own
 * measured box (from model bounds when known, so hex-edge fences block their edge).
 * Bridge models become walkable decks.
 */
export function objectCollision(
  obj: Pick<IslandObject, "model" | "solid" | "scale">,
  manifest: Manifest | null | undefined,
  hexWidth: number,
  bounds?: ModelLocalBounds | null
): ObjectCollision {
  const model = getModel(manifest, obj.model);
  const kind = objectKind(obj.model, manifest);
  const scale = obj.scale ?? 1;
  const mScale = model?.scale ?? 1;
  const size = model?.size;
  if (kind === "bridge") {
    const top = (model?.minY ?? -1) + (size?.[1] ?? 1.2);
    return {
      type: "deck",
      top: top * scale,
      halfWidth: ((size?.[0] ?? hexWidth * 0.6) / 2) * scale,
      halfLength: ((size?.[2] ?? hexWidth) / 2) * scale,
    };
  }
  const solid = obj.solid ?? model?.solid ?? kind !== "flat";
  if (!solid || kind === "flat") return { type: "none" };

  // Box from real bounds (model space, times the manifest and object scales).
  if (bounds) {
    const k = mScale * scale;
    return {
      type: "box",
      hx: Math.max(0.06, ((bounds.max[0] - bounds.min[0]) / 2) * k * 0.92),
      hz: Math.max(0.06, ((bounds.max[2] - bounds.min[2]) / 2) * k * 0.92),
      cx: ((bounds.max[0] + bounds.min[0]) / 2) * k,
      cz: ((bounds.max[2] + bounds.min[2]) / 2) * k,
      blockHex: kind === "building",
    };
  }
  const fp = model?.footprint;
  if (kind === "building") {
    // Roofs and eaves overhang the walls; shrink the measured box a little.
    const w = size?.[0] ?? (fp?.[0] ?? 1) * hexWidth * 0.8;
    const d = size?.[2] ?? (fp?.[1] ?? 1) * hexWidth * 0.8;
    return {
      type: "box",
      hx: (w / 2) * 0.85 * scale,
      hz: (d / 2) * 0.85 * scale,
      cx: 0,
      cz: 0,
      blockHex: true,
    };
  }
  if (kind === "tree") {
    const crown = fp ? Math.max(fp[0], fp[1]) : 1;
    return {
      type: "circle",
      radius: Math.min(0.45, Math.max(0.15, crown * 0.22)) * scale,
    };
  }
  // Props and rocks: their own measured footprint (metres), never the whole hex.
  const w = size?.[0] ?? (model?.footprintUnit === "m" ? fp?.[0] : undefined);
  const d = size?.[2] ?? (model?.footprintUnit === "m" ? fp?.[1] : undefined);
  if (w !== undefined && d !== undefined) {
    const hx = Math.min((w / 2) * 0.85 * scale, hexWidth * 0.6);
    const hz = Math.min((d / 2) * 0.85 * scale, hexWidth * 0.6);
    if (Math.max(hx, hz) < 0.08) return { type: "none" };
    return {
      type: "box",
      hx: Math.max(0.06, hx),
      hz: Math.max(0.06, hz),
      cx: 0,
      cz: 0,
      blockHex: false,
    };
  }
  const defaults: Record<ObjectKind, number> = {
    building: 0,
    tree: 0.3,
    rock: 0.4,
    prop: 0.28,
    flat: 0,
    bridge: 0,
  };
  return { type: "circle", radius: defaults[kind] * scale * (hexWidth / 2) };
}
