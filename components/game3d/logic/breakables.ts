/**
 * Smashable props: which island objects break when the car hits them (trees, bushes,
 * fences, barrels, crates, lamps, pots, small rocks, ...), the low-poly chunk palette
 * for each, and the break store that holds what is broken and when it regrows. Pure: no
 * three, rapier or react imports.
 *
 * The walk world reads `BreakStore.broken` directly (WalkWorld.broken), so while a prop
 * is broken the player may walk through its spot, and it blocks again from the moment it
 * starts to regrow.
 */

import { getModel, objectKind } from "./catalog";
import type { Manifest } from "./types";

/** "breakable" props shatter on impact; "solid" ones are indestructible obstacles. */
export type PropClass = "breakable" | "solid";

/** Never breaks: buildings and landmarks, whatever their kind says. */
const INDESTRUCTIBLE =
  /statue|sculpture|monument|fountain|tower|castle|wall|palace|town-hall|pavilion|canopy|awning|notice|column|well|vehicle|boulder|cliff|mountain|hill|bridge|portal|gallery|studio/i;

/** Breaks: vegetation and small street furniture. */
const BREAKABLE =
  /tree|pine|palm|bush|shrub|hedge|plant|flower|blooms|fence|barrel|crate|box|lamp|lantern|pot|urn|bucket|bench|seat|stump|log|hay|mushroom|crop|pumpkin|cactus|sign|flag|banner|easel|planter|raised-bed|campfire|resource|spool|pipes|paint|mannequin|frame|maquette|cart|workbench|anvil|grass|rock|stone|crystal|drafting|table/i;

/** Rocks above this size (metres, the larger horizontal side) are boulders and stay put. */
const ROCK_BREAK_MAX = 1.3;
/** Props of unknown type break when they are this small. */
const SMALL_PROP_MAX = 1.2;
const SMALL_PROP_HEIGHT = 1.6;
/** Nothing wider than this breaks (except trees, whose footprint is their crown). */
const ANY_PROP_MAX = 1.8;

function text(name: string, manifest: Manifest | null | undefined): string {
  return [name, ...(getModel(manifest, name)?.tags ?? [])].join(" ");
}

/** Whether an island object breaks on impact or is an indestructible obstacle. */
export function propClass(
  name: string,
  manifest: Manifest | null | undefined
): PropClass {
  const model = getModel(manifest, name);
  const kind = objectKind(name, manifest);
  if (kind === "building" || kind === "bridge" || kind === "flat")
    return "solid";
  if (model && (model.kind === "character" || model.kind === "terrain"))
    return "solid";
  const t = text(name, manifest);
  if (INDESTRUCTIBLE.test(t)) return "solid";
  const size = model?.size;
  const wide = size ? Math.max(size[0], size[2]) : 0;
  const tall = size?.[1] ?? 0;
  if (kind === "tree") return "breakable";
  if (wide > ANY_PROP_MAX) return "solid";
  if (kind === "rock" || /rock|stone/i.test(t))
    return wide <= ROCK_BREAK_MAX && tall <= 1 ? "breakable" : "solid";
  if (BREAKABLE.test(t)) return "breakable";
  return wide <= SMALL_PROP_MAX && tall <= SMALL_PROP_HEIGHT
    ? "breakable"
    : "solid";
}

/** sRGB colours for the chunks of a smashed prop (first entry: the toppling piece). */
export function chunkPalette(
  name: string,
  manifest: Manifest | null | undefined
): string[] {
  const t = text(name, manifest);
  const trunk = "#7a5236";
  if (/blossom|cherry|pink/i.test(t))
    return [trunk, "#f2a7c3", "#e98bb0", "#f7c6d8"];
  if (/autumn|fall|orange/i.test(t))
    return [trunk, "#e08a3c", "#d0632e", "#f0b552"];
  if (/tree|pine|palm/i.test(t))
    return [trunk, "#6fae4f", "#5a9a43", "#86c25e"];
  if (/cactus/i.test(t)) return ["#5f9e4a", "#78b65a", "#4f8a3e"];
  if (/flower|blooms|tulip/i.test(t))
    return ["#5f9e4a", "#e2574c", "#9b6bd3", "#f2c94c"];
  if (/bush|shrub|hedge|plant|grass|mushroom/i.test(t))
    return ["#5a9a43", "#6fae4f", "#4c8a3a", "#86c25e"];
  if (/crystal/i.test(t)) return ["#7fd6e8", "#a4e6f2", "#5bb8d6"];
  if (/lamp|lantern/i.test(t))
    return ["#3d3a40", "#57525a", "#f5c35b", "#2f2c31"];
  if (/pot|urn|clay/i.test(t)) return ["#c8734a", "#b25f3b", "#d98b5f"];
  if (/hay|crop|pumpkin/i.test(t)) return ["#e8c25a", "#d9a441", "#c98b2f"];
  if (/rock|stone/i.test(t)) return ["#9da3aa", "#868c94", "#b4b9bf"];
  if (/flag|banner/i.test(t)) return ["#6e4127", "#d8473c", "#3f7fcf"];
  return ["#a8693f", "#8a5530", "#c98f5a", "#6e4127"];
}

/* -------------------------------------------------------------- break store */

/** A smashed prop regrows this long after it broke. */
export const REGROW_DELAY_MS = 30_000;
/** Regrowth (scale-up from the ground) duration. */
export const REGROW_MS = 900;
/** When the spot is occupied at regrow time, try again after this long. */
export const REGROW_RETRY_MS = 1_000;

export type BreakStore = {
  /** key -> performance time (ms) at which it may start to regrow. */
  broken: Map<string, number>;
  /** key -> performance time (ms) at which its regrowth started. */
  growing: Map<string, number>;
  /** Bumped on every change, so renderers know when to refresh their instances. */
  version: number;
};

export function createBreakStore(): BreakStore {
  return { broken: new Map(), growing: new Map(), version: 0 };
}

/** Break a prop at `now` (ms). Returns false when it is already broken. */
export function breakProp(
  store: BreakStore,
  key: string,
  now: number
): boolean {
  if (store.broken.has(key)) return false;
  store.growing.delete(key);
  store.broken.set(key, now + REGROW_DELAY_MS);
  store.version++;
  return true;
}

/**
 * Advance regrowth: broken props whose delay has passed start growing back (unless
 * `canRegrow` says the spot is occupied, then they retry a second later); growing props
 * finish after REGROW_MS. Returns the keys that started and finished.
 */
export function tickRegrow(
  store: BreakStore,
  now: number,
  canRegrow: (key: string) => boolean = () => true
): { started: string[]; finished: string[] } {
  const started: string[] = [];
  const finished: string[] = [];
  for (const [key, due] of store.broken) {
    if (now < due) continue;
    if (!canRegrow(key)) {
      store.broken.set(key, now + REGROW_RETRY_MS);
      continue;
    }
    store.broken.delete(key);
    store.growing.set(key, now);
    started.push(key);
  }
  for (const [key, start] of store.growing) {
    if (now - start >= REGROW_MS) {
      store.growing.delete(key);
      finished.push(key);
    }
  }
  // Growing props animate every frame, so keep the version moving while any grow.
  if (started.length || finished.length || store.growing.size) store.version++;
  return { started, finished };
}

/** Ease out with a small overshoot (a springy regrow). */
export function easeOutBack(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  const k = 1.4;
  return 1 + (k + 1) * Math.pow(c - 1, 3) + k * Math.pow(c - 1, 2);
}

/** Render scale factor of a prop: 0 while broken, easing up while it regrows, else 1. */
export function propScale(store: BreakStore, key: string, now: number): number {
  if (store.broken.has(key)) return 0;
  const start = store.growing.get(key);
  if (start === undefined) return 1;
  return Math.max(0, easeOutBack((now - start) / REGROW_MS));
}

/** Keys whose render scale is not 1 (broken or growing). */
export function touchedKeys(store: BreakStore): string[] {
  return [...store.broken.keys(), ...store.growing.keys()];
}
