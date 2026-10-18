/** "3 hours ago" style dates for guestbook messages. */

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function relativeTime(
  iso: string,
  nowMs: number,
  locale: string
): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const secs = Math.round((at - nowMs) / 1000);
  const abs = Math.abs(secs);
  for (const [unit, size] of UNITS)
    if (abs >= size) return fmt.format(Math.round(secs / size), unit);
  return fmt.format(0, "second");
}
