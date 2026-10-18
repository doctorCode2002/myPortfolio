/**
 * Supabase settings for the social layer (visitor ghosts and the guestbook).
 *
 * The publishable key is public by design: it only carries the `anon` role, and the
 * database's row-level security decides what that role may do (insert pending guestbook
 * messages, read approved ones). Override both with NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 */

export const SUPABASE_URL: string =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://xaqrvefokpflahxhxusy.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY: string =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_y8NtpIf71q5xzNw6A37jrA_etF9xrsW";

/** True when both settings are present (an empty override switches the social layer off). */
export function socialConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

/** The Realtime channel every visitor joins. */
export const WORLD_CHANNEL = "world";

export const GUESTBOOK = {
  table: "guestbook_messages",
  /** Columns the anon role may read; always select these explicitly (never `*`). */
  columns: "id,name,message,locale,island,created_at",
  listLimit: 20,
  nameMax: 40,
  messageMax: 240,
} as const;

export const PRESENCE = {
  /** Fastest send rate while moving (4 Hz). */
  moveIntervalMs: 250,
  /** Heartbeat while standing still. */
  idleIntervalMs: 5000,
  /** Ghosts fade after this long without an update... */
  staleMs: 15000,
  /** ...over this long, then they are dropped. */
  fadeMs: 1500,
  /** Ghosts drawn at once (the nearest). */
  maxGhosts: 12,
  /** Render this far behind the newest sample so there is something to interpolate to. */
  renderDelayMs: 320,
  /** Samples kept per ghost. */
  bufferSize: 6,
} as const;
