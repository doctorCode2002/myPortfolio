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

export type ObjectKind = "building" | "tree" | "rock" | "prop" | "flat";

const TREE =
  /tree|pine|palm|bush|shrub|plant|foliage|hedge|flower|grass-tuft|mushroom/i;
const ROCK = /rock|stone-big|boulder|cliff/i;
const BUILDING =
  /building|house|home|tower|castle|hall|shop|market|tavern|barn|mill|well|temple|library|school|portal|board|gate|cottage|keep|stage|tent|warehouse|archive/i;
const FLAT = /flat|decal|path|road|rug|carpet|grass-patch|flowers-flat/i;

/** Rough category used for fallback rendering and default collision. */
export function objectKind(
  name: string,
  manifest?: Manifest | null
): ObjectKind {
  const model = getModel(manifest, name);
  const text = nameAndTags(name, model);
  if (FLAT.test(text)) return "flat";
  if (model?.kind === "building" || BUILDING.test(text)) return "building";
  if (TREE.test(text)) return "tree";
  if (ROCK.test(text)) return "rock";
  return "prop";
}

/** Foliage materials get the wind-sway shader patch. */
export function isFoliage(name: string, manifest?: Manifest | null): boolean {
  const text = nameAndTags(name, getModel(manifest, name));
  return /tree|pine|palm|bush|shrub|plant|foliage|hedge|flower|grass/i.test(
    text
  );
}

export type ObjectCollision =
  | { type: "none" }
  /** A circle obstacle of `radius` metres around the object position. */
  | { type: "circle"; radius: number }
  /**
   * An oriented box obstacle (half extents in metres, before the object's rotation).
   * `blockHex` also closes the object's own hex, so doors sit on a neighbouring hex.
   */
  | { type: "box"; hx: number; hz: number; blockHex: boolean };

/**
 * How an object blocks walking. Buildings (and anything with a hex footprint) become
 * boxes from the manifest's measured size and close their own hex; trees are small
 * trunk circles; other solid props are boxes from their metre footprint (fences stay thin).
 */
export function objectCollision(
  obj: Pick<IslandObject, "model" | "solid" | "scale">,
  manifest: Manifest | null | undefined,
  hexWidth: number
): ObjectCollision {
  const model = getModel(manifest, obj.model);
  const kind =
    model?.kind === "terrain" || model?.overlay
      ? "flat"
      : objectKind(obj.model, manifest);
  const solid = obj.solid ?? model?.solid ?? kind !== "flat";
  if (!solid || kind === "flat") return { type: "none" };
  const scale = obj.scale ?? 1;
  const size = model?.size;
  const fp = model?.footprint;
  const hexFootprint =
    model?.footprintUnit === "hex" || (!model && kind === "building");
  if (kind === "building" || hexFootprint) {
    // Roofs and eaves overhang the walls; shrink the measured box a little.
    const w = size?.[0] ?? (fp?.[0] ?? 1) * hexWidth * 0.8;
    const d = size?.[2] ?? (fp?.[1] ?? 1) * hexWidth * 0.8;
    return {
      type: "box",
      hx: (w / 2) * 0.85 * scale,
      hz: (d / 2) * 0.85 * scale,
      blockHex: true,
    };
  }
  if (kind === "tree") {
    const crown = fp ? Math.max(fp[0], fp[1]) : 1;
    return {
      type: "circle",
      radius: Math.min(0.45, Math.max(0.18, crown * 0.22)) * scale,
    };
  }
  if (fp) {
    return {
      type: "box",
      hx: (fp[0] / 2) * 0.9 * scale,
      hz: (fp[1] / 2) * 0.9 * scale,
      blockHex: false,
    };
  }
  const defaults: Record<ObjectKind, number> = {
    building: 0,
    tree: 0.3,
    rock: 0.45,
    prop: 0.3,
    flat: 0,
  };
  return { type: "circle", radius: defaults[kind] * scale * (hexWidth / 2) };
}
