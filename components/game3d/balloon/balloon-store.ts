/**
 * The balloon's small UI store: what the HUD shows (the boarding chooser, the flight
 * phase, the island being passed, a "can't land here" hint) and what it asks the 3D
 * system for (start a tour or a free flight, land, leave the tour, the touch Up / Down
 * buttons). A module singleton like the meta store, so the HUD outside the canvas and
 * the system inside it talk without props.
 */

export type BalloonPhase = "parked" | "tour" | "free" | "auto";
export type BalloonHint = "lower" | "noRoom" | null;

export type BalloonUiSnapshot = {
  chooser: boolean;
  phase: BalloonPhase;
  /** Island id whose name shows (the scenic tour passing it). */
  label: string | null;
  /** The last island shown (kept while the name fades out). */
  lastLabel: string | null;
  hint: BalloonHint;
  /** Bumped with each hint, so the same hint can flash again. */
  hintSeq: number;
};

let snap: BalloonUiSnapshot = {
  chooser: false,
  phase: "parked",
  label: null,
  lastLabel: null,
  hint: null,
  hintSeq: 0,
};
const listeners = new Set<() => void>();

const SERVER: BalloonUiSnapshot = snap;

export function getBalloonUi(): BalloonUiSnapshot {
  return snap;
}

export function getServerBalloonUi(): BalloonUiSnapshot {
  return SERVER;
}

export function subscribeBalloonUi(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Change some fields (only notifies when something changed). */
export function setBalloonUi(patch: Partial<BalloonUiSnapshot>): void {
  let changed = false;
  for (const k of Object.keys(patch) as (keyof BalloonUiSnapshot)[])
    if (patch[k] !== snap[k]) changed = true;
  if (!changed) return;
  snap = { ...snap, ...patch };
  for (const cb of listeners) cb();
}

export function flashBalloonHint(hint: Exclude<BalloonHint, null>): void {
  setBalloonUi({ hint, hintSeq: snap.hintSeq + 1 });
}

/** Requests from the HUD, consumed in the balloon system's frame. */
export const balloonRequests = {
  start: null as "tour" | "free" | null,
  /** E / the Land button (free flight) or Leave (tour). */
  action: false,
  /** Touch Up / Down buttons, held. */
  up: false,
  down: false,
};
