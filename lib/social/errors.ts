/** Maps whatever Supabase (or the network) throws into a few cases the UI can explain. */

export type SocialError = "rate_limited" | "offline" | "invalid" | "unknown";

export function mapSocialError(err: unknown): SocialError {
  if (err === null || err === undefined) return "unknown";
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return "offline";
  const e = err as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    status?: unknown;
    name?: unknown;
  };
  const text = [e.message, e.details, e.name]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  if (text.includes("rate_limited")) return "rate_limited";
  if (e.status === 429) return "rate_limited";
  // 23514 check_violation, 22001 string too long, 23502 not null.
  if (e.code === "23514" || e.code === "22001" || e.code === "23502")
    return "invalid";
  if (
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("network request failed") ||
    text.includes("load failed") ||
    text.includes("timeout") ||
    text.includes("aborted") ||
    text.includes("unavailable") ||
    e.status === 0 ||
    e.status === 502 ||
    e.status === 503 ||
    e.status === 504 ||
    e.name === "TypeError" ||
    e.name === "AbortError"
  )
    return "offline";
  return "unknown";
}
