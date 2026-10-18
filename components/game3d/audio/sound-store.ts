/**
 * Sound on/off (muted by default; the choice is remembered in localStorage) and a tiny
 * event bus the game systems use to ask for one-shot sounds (car impacts). Nothing here
 * loads audio: the audio system is imported only once sound is on.
 */

const KEY = "game3d.sound";

type Listener = () => void;
const listeners = new Set<Listener>();
let enabled: boolean | null = null;

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function soundEnabled(): boolean {
  if (enabled === null) enabled = typeof window !== "undefined" && read();
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
  for (const cb of listeners) cb();
}

export function subscribeSound(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** One-shot sound requests (strength 0..1). */
export type SoundCue =
  | { kind: "impact"; strength: number }
  /** A synthesized chime (sky shard pickups; `pitch` < 1 for lighting a fire). */
  | { kind: "chime"; strength: number; pitch?: number };
type CueListener = (cue: SoundCue) => void;
const cueListeners = new Set<CueListener>();

/** Fire-and-forget: does nothing unless the audio system is listening. */
export function emitSoundCue(cue: SoundCue): void {
  for (const cb of cueListeners) cb(cue);
}

export function onSoundCue(cb: CueListener): () => void {
  cueListeners.add(cb);
  return () => {
    cueListeners.delete(cb);
  };
}
