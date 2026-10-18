/**
 * The exploration meta store: passport progress (persisted in localStorage under a
 * versioned key), unlock toasts, and the UI state shared by the 3D systems and the React
 * overlays (passport open, photo mode, minimap target, fast travel). A module singleton
 * like `gameEvents` and the atmosphere store, so both sides talk without props.
 */

import { BRIDGES, ISLANDS } from "@/lib/content/world";
import { SHARDS } from "@/lib/content/collectibles";
import {
  addTo,
  allShardsFound,
  emptyProgress,
  evaluateAchievements,
  parseProgress,
  type AchievementId,
  type MetaRules,
  type MetaSettings,
  type Progress,
  SMASH_GOAL,
} from "./progress";

export const STORAGE_KEY = "game3d.meta.v1";

export const RULES: MetaRules = {
  mayorIslands: ISLANDS.filter((i) => i.mayor).map((i) => i.id),
  bridgeIds: BRIDGES.map((b) => `${b.from}-${b.to}`),
};

/** Mayor id -> island id. */
export const MAYOR_ISLAND: Readonly<Record<string, string>> =
  Object.fromEntries(
    ISLANDS.flatMap((i) => (i.mayor ? [[i.mayor.id, i.id]] : []))
  );

export type Toast =
  | { id: number; kind: "achievement"; achievement: AchievementId }
  | { id: number; kind: "shard"; found: number; total: number }
  | { id: number; kind: "stamp"; islandId: string }
  | { id: number; kind: "fire"; islandId: string }
  | { id: number; kind: "unlock"; reward: "goldCar" | "goldCloak" };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
type ToastInput = DistributiveOmit<Toast, "id">;

export type PhotoFilter = "none" | "warm" | "cool" | "mono";

export type MetaUi = {
  passportOpen: boolean;
  photo: boolean;
  photoFilter: PhotoFilter;
  photoCaption: boolean;
  /** Minimap target island (compass arrow). */
  target: string | null;
  /** Fast travel fade: "out" to the sky, then "in" at the fire. */
  travel: { phase: "idle" | "out" | "in"; to: string | null };
  minimapOpen: boolean;
};

export type MetaSnapshot = {
  progress: Progress;
  ui: MetaUi;
  toasts: readonly Toast[];
};

type Listener = () => void;
const listeners = new Set<Listener>();

let progress: Progress = emptyProgress();
let loaded = false;
const ui: MetaUi = {
  passportOpen: false,
  photo: false,
  photoFilter: "none",
  photoCaption: true,
  target: null,
  travel: { phase: "idle", to: null },
  minimapOpen: true,
};
let toasts: Toast[] = [];
let toastSeq = 0;
let snapshot: MetaSnapshot | null = null;

/** Requests the 3D side consumes in its frame loop. */
export const metaRequests = {
  travel: null as string | null,
  /** Bumped by the download button; the photo camera grabs one frame per bump. */
  capture: 0,
};

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    progress = parseProgress(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    progress = emptyProgress();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void {
  if (typeof window === "undefined") return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Private mode or blocked storage: progress lasts for this visit only.
    }
  }, 250);
}

function notify(): void {
  snapshot = null;
  for (const cb of listeners) cb();
}

export function subscribeMeta(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getMetaSnapshot(): MetaSnapshot {
  ensureLoaded();
  snapshot ??= {
    progress: structuredClone(progress),
    ui: { ...ui, travel: { ...ui.travel } },
    toasts,
  };
  return snapshot;
}

const SERVER_SNAPSHOT: MetaSnapshot = {
  progress: emptyProgress(),
  ui: { ...ui },
  toasts: [],
};
export function getServerMetaSnapshot(): MetaSnapshot {
  return SERVER_SNAPSHOT;
}

/** The live progress (read-only for frame loops; mutate through the functions below). */
export function liveProgress(): Readonly<Progress> {
  ensureLoaded();
  return progress;
}

export function liveUi(): Readonly<MetaUi> {
  return ui;
}

function pushToast(t: ToastInput): void {
  toastSeq += 1;
  toasts = [...toasts, { ...t, id: toastSeq } as Toast].slice(-4);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

/** Re-check achievements after a change; toasts for anything new. */
function commit(): void {
  for (const a of evaluateAchievements(progress, RULES))
    pushToast({ kind: "achievement", achievement: a });
  save();
  notify();
}

export function markVisited(islandId: string): void {
  ensureLoaded();
  if (!addTo(progress, "visited", islandId)) return;
  pushToast({ kind: "stamp", islandId });
  commit();
}

export function markMayorMet(islandId: string): void {
  ensureLoaded();
  if (!addTo(progress, "mayors", islandId)) return;
  commit();
}

export function markTour(islandId: string): void {
  ensureLoaded();
  if (!addTo(progress, "tours", islandId)) return;
  commit();
}

export function collectShard(id: string): boolean {
  ensureLoaded();
  if (!addTo(progress, "shards", id)) return false;
  const total = SHARDS.length;
  const found = progress.shards.length;
  pushToast({ kind: "shard", found, total });
  if (found === total) {
    pushToast({ kind: "unlock", reward: "goldCar" });
    pushToast({ kind: "unlock", reward: "goldCloak" });
  }
  commit();
  return true;
}

export function lightFire(islandId: string): boolean {
  ensureLoaded();
  if (!addTo(progress, "fires", islandId)) return false;
  addTo(progress, "visited", islandId);
  pushToast({ kind: "fire", islandId });
  commit();
  return true;
}

export function markBridge(id: string): void {
  ensureLoaded();
  if (!addTo(progress, "bridges", id)) return;
  commit();
}

export function addSmashes(n: number): void {
  ensureLoaded();
  if (n <= 0) return;
  const before = progress.smashed;
  progress.smashed += n;
  // Only re-render the overlays when the count matters (the goal, or the passport is open).
  if (before < SMASH_GOAL || ui.passportOpen) commit();
  else save();
}

export function markWeather(kind: "night" | "rain"): void {
  ensureLoaded();
  if (progress[kind]) return;
  progress[kind] = true;
  commit();
}

/** Above the clouds: a scenic balloon tour flown to the end, or the balloon's ceiling. */
export function markAboveClouds(): void {
  ensureLoaded();
  if (progress.sky) return;
  progress.sky = true;
  commit();
}

export function setSetting<K extends keyof MetaSettings>(
  key: K,
  value: MetaSettings[K]
): void {
  ensureLoaded();
  progress.settings[key] = value;
  save();
  notify();
}

export function rewardsUnlocked(): boolean {
  ensureLoaded();
  return allShardsFound(progress);
}

export function setPassportOpen(open: boolean): void {
  if (ui.passportOpen === open) return;
  ui.passportOpen = open;
  notify();
}

export function setPhoto(on: boolean): void {
  if (ui.photo === on) return;
  ui.photo = on;
  notify();
}

export function setPhotoFilter(f: PhotoFilter): void {
  ui.photoFilter = f;
  notify();
}

export function setPhotoCaption(on: boolean): void {
  ui.photoCaption = on;
  notify();
}

export function setTarget(islandId: string | null): void {
  ui.target = islandId;
  notify();
}

export function setMinimapOpen(open: boolean): void {
  ui.minimapOpen = open;
  notify();
}

export function requestTravel(islandId: string): void {
  if (ui.travel.phase !== "idle") return;
  metaRequests.travel = islandId;
}

export function setTravelPhase(
  phase: MetaUi["travel"]["phase"],
  to: string | null
): void {
  ui.travel = { phase, to };
  notify();
}

export function requestCapture(): void {
  metaRequests.capture += 1;
}

/** Tests and the dev console: forget everything. */
export function resetProgress(): void {
  progress = emptyProgress();
  toasts = [];
  save();
  notify();
}
