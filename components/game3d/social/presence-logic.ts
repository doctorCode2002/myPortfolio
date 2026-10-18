/**
 * Pure logic for the visitor ghosts: what goes on the wire, when to send, how a ghost's
 * samples are buffered and interpolated, which ghosts are drawn and how they fade.
 * Nothing here touches the network or Three.js, so it is unit tested directly.
 */

import { PRESENCE } from "@/lib/social/config";

export type MoveMode = "walk" | "drive" | "glide" | "balloon";

/** One position update as broadcast to the other visitors (anonymous; no personal data). */
export type WirePos = {
  /** Random per-tab id. */
  id: string;
  /** Character picker id (char_0..char_5). */
  char: string;
  island: string | null;
  x: number;
  y: number;
  z: number;
  heading: number;
  mode: MoveMode;
  /** Sender clock (ms); only used to drop out-of-order packets. */
  t: number;
};

export type Pose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  island: string | null;
  mode: MoveMode;
  char: string;
};

export type Sample = { at: number; x: number; y: number; z: number; h: number };

export type GhostState = {
  id: string;
  char: string;
  island: string | null;
  mode: MoveMode;
  samples: Sample[];
  /** Local clock (ms) of the last update. */
  lastSeen: number;
  /** Sender clock of the newest accepted update. */
  lastSenderT: number;
};

/** Interpolated pose written by `sampleGhost` (reused, no per-frame allocation). */
export type GhostPose = {
  x: number;
  y: number;
  z: number;
  h: number;
  /** Ground speed in m/s between the bracketing samples. */
  speed: number;
};

const LIMIT = 5000;
const MODES: readonly MoveMode[] = ["walk", "drive", "glide", "balloon"];

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Normalises an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  const TAU = Math.PI * 2;
  let r = a % TAU;
  if (r <= -Math.PI) r += TAU;
  else if (r > Math.PI) r -= TAU;
  return r;
}

/** Shortest-path angle interpolation. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

/** The compact payload for a pose (positions rounded to cm to keep packets small). */
export function toWire(id: string, pose: Pose, now: number): WirePos {
  return {
    id,
    char: pose.char,
    island: pose.island,
    x: round2(pose.x),
    y: round2(pose.y),
    z: round2(pose.z),
    heading: round2(wrapAngle(pose.heading)),
    mode: pose.mode,
    t: Math.round(now),
  };
}

/** Validates an incoming (untrusted) payload; null when it is malformed. */
export function sanitizeWire(raw: unknown): WirePos | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) < LIMIT
      ? v
      : null;
  const x = num(r.x);
  const y = num(r.y);
  const z = num(r.z);
  const heading = num(r.heading);
  const t = typeof r.t === "number" && Number.isFinite(r.t) ? r.t : null;
  if (x === null || y === null || z === null || heading === null || t === null)
    return null;
  if (typeof r.id !== "string" || !/^[a-z0-9-]{4,64}$/i.test(r.id)) return null;
  const char =
    typeof r.char === "string" && /^char_\d{1,2}$/.test(r.char)
      ? r.char
      : "char_0";
  const island =
    typeof r.island === "string" && /^[a-z0-9_-]{1,40}$/i.test(r.island)
      ? r.island
      : null;
  const mode = MODES.includes(r.mode as MoveMode)
    ? (r.mode as MoveMode)
    : "walk";
  return { id: r.id, char, island, x, y, z, heading, mode, t };
}

export type SendState = { at: number; pose: Pose } | null;

/**
 * Throttle: send at most every `moveIntervalMs` while the pose changes, and a heartbeat
 * every `idleIntervalMs` while standing still (so others don't see us fade).
 */
export function shouldSend(
  last: SendState,
  now: number,
  pose: Pose,
  moveMs: number = PRESENCE.moveIntervalMs,
  idleMs: number = PRESENCE.idleIntervalMs
): boolean {
  if (!last) return true;
  const dt = now - last.at;
  const p = last.pose;
  const changed =
    Math.hypot(pose.x - p.x, pose.z - p.z) > 0.05 ||
    Math.abs(pose.y - p.y) > 0.1 ||
    Math.abs(wrapAngle(pose.heading - p.heading)) > 0.12 ||
    pose.mode !== p.mode ||
    pose.island !== p.island ||
    pose.char !== p.char;
  return changed ? dt >= moveMs : dt >= idleMs;
}

/** Jumps longer than this (teleports, respawns) snap instead of sliding across the sky. */
const SNAP_DISTANCE = 25;

export function createGhost(msg: WirePos, now: number): GhostState {
  return {
    id: msg.id,
    char: msg.char,
    island: msg.island,
    mode: msg.mode,
    samples: [{ at: now, x: msg.x, y: msg.y, z: msg.z, h: msg.heading }],
    lastSeen: now,
    lastSenderT: msg.t,
  };
}

/** Adds an update to a ghost's buffer; returns false for stale (out-of-order) packets. */
export function pushSample(
  g: GhostState,
  msg: WirePos,
  now: number,
  bufferSize: number = PRESENCE.bufferSize
): boolean {
  if (msg.t <= g.lastSenderT) return false;
  g.lastSenderT = msg.t;
  g.lastSeen = now;
  g.char = msg.char;
  g.island = msg.island;
  g.mode = msg.mode;
  const prev = g.samples[g.samples.length - 1];
  if (prev && Math.hypot(msg.x - prev.x, msg.z - prev.z) > SNAP_DISTANCE)
    g.samples.length = 0;
  // A long silence (idle heartbeat) shouldn't turn into a slow slide: restart the
  // timeline from "now" at the previous point.
  if (prev && now - prev.at > PRESENCE.idleIntervalMs * 1.5) {
    g.samples.length = 0;
    g.samples.push({
      at: now - PRESENCE.moveIntervalMs,
      x: prev.x,
      y: prev.y,
      z: prev.z,
      h: prev.h,
    });
  }
  g.samples.push({ at: now, x: msg.x, y: msg.y, z: msg.z, h: msg.heading });
  while (g.samples.length > bufferSize) g.samples.shift();
  return true;
}

/**
 * The ghost's pose at local time `renderAt` (usually now minus `renderDelayMs`):
 * interpolated between the bracketing samples, held at the ends.
 */
export function sampleGhost(
  g: GhostState,
  renderAt: number,
  out: GhostPose
): GhostPose {
  const s = g.samples;
  const n = s.length;
  out.speed = 0;
  if (n === 0) return out;
  const first = s[0] as Sample;
  const last = s[n - 1] as Sample;
  if (n === 1 || renderAt <= first.at) {
    out.x = first.x;
    out.y = first.y;
    out.z = first.z;
    out.h = first.h;
    return out;
  }
  if (renderAt >= last.at) {
    out.x = last.x;
    out.y = last.y;
    out.z = last.z;
    out.h = last.h;
    return out;
  }
  for (let i = 1; i < n; i++) {
    const b = s[i] as Sample;
    if (b.at < renderAt) continue;
    const a = s[i - 1] as Sample;
    const span = Math.max(1, b.at - a.at);
    const t = (renderAt - a.at) / span;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    out.h = lerpAngle(a.h, b.h, t);
    out.speed = Math.hypot(b.x - a.x, b.z - a.z) / (span / 1000);
    return out;
  }
  return out;
}

/** Opacity factor: 1 while fresh, fading to 0 over `fadeMs` after `staleMs` of silence. */
export function ghostAlpha(
  ageMs: number,
  staleMs: number = PRESENCE.staleMs,
  fadeMs: number = PRESENCE.fadeMs
): number {
  if (ageMs <= staleMs) return 1;
  return Math.max(0, 1 - (ageMs - staleMs) / fadeMs);
}

/** True once a ghost has fully faded and can be forgotten. */
export function ghostExpired(
  ageMs: number,
  staleMs: number = PRESENCE.staleMs,
  fadeMs: number = PRESENCE.fadeMs
): boolean {
  return ageMs > staleMs + fadeMs;
}

/** Ids of the (up to) `max` nearest live ghosts to (px, pz), nearest first. */
export function selectNearest(
  ghosts: Iterable<GhostState>,
  px: number,
  pz: number,
  now: number,
  max: number = PRESENCE.maxGhosts
): string[] {
  const list: { id: string; d: number }[] = [];
  for (const g of ghosts) {
    if (ghostExpired(now - g.lastSeen)) continue;
    const s = g.samples[g.samples.length - 1];
    if (!s) continue;
    list.push({ id: g.id, d: Math.hypot(s.x - px, s.z - pz) });
  }
  list.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1));
  return list.slice(0, max).map((e) => e.id);
}

/** Random anonymous id for this tab. */
export function randomVisitorId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `v-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}
