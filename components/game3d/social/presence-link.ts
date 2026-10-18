/**
 * The Realtime connection for visitor ghosts (one per tab, module level so the 3D scene
 * and the overlay toggles share it).
 *
 * - Broadcast event "pos" carries positions (throttled by the sender, see `shouldSend`).
 * - Presence carries only the roster ({ id, char }) so departures remove ghosts at once.
 *
 * Everything degrades silently: if Supabase can't be loaded or reached, there are simply
 * no ghosts and nothing is sent.
 */

import type { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/social/client";
import { WORLD_CHANNEL } from "@/lib/social/config";
import {
  getSocialPrefs,
  subscribeSocialPrefs,
  type SocialPrefs,
} from "@/lib/social/prefs";
import {
  createGhost,
  ghostExpired,
  pushSample,
  randomVisitorId,
  sanitizeWire,
  type GhostState,
  type WirePos,
} from "./presence-logic";

/** A hard cap on remembered ghosts (memory guard against floods). */
const MAX_TRACKED = 120;

export const ghosts = new Map<string, GhostState>();
export const selfId = typeof window === "undefined" ? "ssr" : randomVisitorId();

let channel: RealtimeChannel | null = null;
let subscribed = false;
let starting = false;
let wanted = false;
let char = "char_0";
let tracked = false;
let offPrefs: (() => void) | null = null;

function onPos(raw: unknown): void {
  if (!getSocialPrefs().show) return;
  const msg = sanitizeWire(raw);
  if (!msg || msg.id === selfId) return;
  const now = performance.now();
  const g = ghosts.get(msg.id);
  if (g) pushSample(g, msg, now);
  else {
    if (ghosts.size >= MAX_TRACKED) prune(now);
    if (ghosts.size >= MAX_TRACKED) return;
    ghosts.set(msg.id, createGhost(msg, now));
  }
}

/** Forget ghosts that have fully faded. */
export function prune(now: number): void {
  for (const [id, g] of ghosts)
    if (ghostExpired(now - g.lastSeen)) ghosts.delete(id);
}

function syncTrack(): void {
  if (!channel || !subscribed) return;
  const share = getSocialPrefs().share;
  if (share && !tracked) {
    tracked = true;
    void channel.track({ id: selfId, char }).catch(() => {
      tracked = false;
    });
  } else if (!share && tracked) {
    tracked = false;
    void channel.untrack().catch(() => undefined);
  }
}

async function open(): Promise<void> {
  if (channel || starting) return;
  starting = true;
  const sb = await getSupabase();
  starting = false;
  if (!sb || !wanted || channel) return;
  const ch = sb.channel(WORLD_CHANNEL, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: selfId, enabled: true },
    },
  });
  ch.on("broadcast", { event: "pos" }, ({ payload }) => onPos(payload));
  ch.on("presence", { event: "leave" }, ({ key }) => {
    if (typeof key === "string") ghosts.delete(key);
  });
  ch.subscribe((status) => {
    subscribed = status === "SUBSCRIBED";
    if (subscribed) {
      tracked = false;
      syncTrack();
    }
  });
  channel = ch;
}

function close(): void {
  const ch = channel;
  channel = null;
  subscribed = false;
  tracked = false;
  ghosts.clear();
  if (ch) void getSupabase().then((sb) => sb?.removeChannel(ch));
}

function applyPrefs(p: SocialPrefs): void {
  if (!wanted) return;
  if (!p.show) ghosts.clear();
  if (p.show || p.share) void open();
  else close();
  syncTrack();
}

/** Join the world channel (call once the world has loaded). Returns a stop function. */
export function startPresence(charId: string): () => void {
  char = charId;
  wanted = true;
  offPrefs ??= subscribeSocialPrefs(() => applyPrefs(getSocialPrefs()));
  applyPrefs(getSocialPrefs());
  return () => {
    wanted = false;
    offPrefs?.();
    offPrefs = null;
    close();
  };
}

/** Update the roster entry when the visitor picks another character. */
export function setPresenceChar(charId: string): void {
  if (charId === char) return;
  char = charId;
  if (channel && subscribed && tracked)
    void channel.track({ id: selfId, char }).catch(() => undefined);
}

/** Broadcast a position (the caller throttles). No-op unless connected and sharing. */
export function sendPosition(msg: WirePos): boolean {
  if (!channel || !subscribed || !getSocialPrefs().share) return false;
  void channel
    .send({ type: "broadcast", event: "pos", payload: msg })
    .catch(() => undefined);
  return true;
}

/** True while connected (for the overlay's status dot). */
export function presenceConnected(): boolean {
  return subscribed;
}
