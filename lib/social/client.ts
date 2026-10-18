/**
 * The lazily loaded Supabase client. `@supabase/supabase-js` is fetched with a dynamic
 * import the first time something social is needed (after the world has loaded), so it
 * never weighs on the first paint. Every failure resolves to `null` / an error value and
 * the game carries on without the social layer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  GUESTBOOK,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  socialConfigured,
} from "./config";
import { mapSocialError, type SocialError } from "./errors";
import { validateGuestbook, type GuestbookLocale } from "./validate";

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (clientPromise) return clientPromise;
  if (typeof window === "undefined" || !socialConfigured())
    return Promise.resolve(null);
  clientPromise ??= import("@supabase/supabase-js")
    .then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        realtime: { params: { eventsPerSecond: 8 } },
      })
    )
    .catch((err: unknown) => {
      console.warn("[social] Supabase client unavailable", err);
      clientPromise = null;
      return null;
    });
  return clientPromise;
}

/** For tests: swap the client loader. */
export function __setSupabaseForTests(
  client: SupabaseClient | null | undefined
): void {
  clientPromise = client === undefined ? null : Promise.resolve(client);
}

export type GuestbookMessage = {
  id: string;
  name: string;
  message: string;
  locale: GuestbookLocale;
  island: string | null;
  created_at: string;
};

const REQUEST_TIMEOUT_MS = 8000;

function withTimeout<T>(
  p: PromiseLike<T>,
  ms = REQUEST_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Object.assign(new Error("timeout"), { name: "AbortError" })),
      ms
    );
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    );
  });
}

/** The latest approved messages (RLS hides pending ones; columns are explicit). */
export async function fetchGuestbook(): Promise<
  { ok: true; messages: GuestbookMessage[] } | { ok: false; error: SocialError }
> {
  const sb = await getSupabase();
  if (!sb) return { ok: false, error: "offline" };
  try {
    const { data, error } = await withTimeout(
      sb
        .from(GUESTBOOK.table)
        // No `approved` filter: RLS already returns only approved rows to anon, and
        // anon has no grant on that column (filtering on it is a 401).
        .select(GUESTBOOK.columns)
        .order("created_at", { ascending: false })
        .limit(GUESTBOOK.listLimit)
    );
    if (error) return { ok: false, error: mapSocialError(error) };
    const rows = (data ?? []) as unknown as GuestbookMessage[];
    return { ok: true, messages: rows };
  } catch (err) {
    return { ok: false, error: mapSocialError(err) };
  }
}

/** Sends a message; it stays hidden until the owner approves it. */
export async function submitGuestbook(input: {
  name: string;
  message: string;
  locale: string;
  island?: string | null;
}): Promise<{ ok: true } | { ok: false; error: SocialError }> {
  const checked = validateGuestbook(input);
  if (!checked.ok) return { ok: false, error: "invalid" };
  const sb = await getSupabase();
  if (!sb) return { ok: false, error: "offline" };
  try {
    // No .select(): the anon role can't read pending rows back (return=minimal).
    const { error } = await withTimeout(
      sb.from(GUESTBOOK.table).insert(checked.value)
    );
    if (error) return { ok: false, error: mapSocialError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapSocialError(err) };
  }
}
