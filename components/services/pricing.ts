import type { ServiceId } from "@/lib/content/services";

/**
 * "From" prices — OWNER TO FILL IN.
 *
 * Every value is null on purpose: nothing renders until a real price is set,
 * so the page never shows an invented number. Set `sar` and/or `usd` (whole
 * numbers) for productizable offers such as a logo package, identity kit,
 * landing page or automation audit; leave custom builds null and they keep
 * the "quoted per scope" wording.
 */
export type PriceFrom = { sar: number | null; usd: number | null };

export const PRICE_FROM: Record<ServiceId, PriceFrom | null> = {
  logo: null,
  identity: null,
  aiDesign: null,
  video: null,
  animation: null,
  uiux: null,
  web: null,
  mobile: null,
  aiWorkflows: null,
};

/** Same idea for the two engagement types. */
export const ENGAGEMENT_PRICE_FROM: Record<
  "project" | "retainer",
  PriceFrom | null
> = {
  project: null,
  retainer: null,
};

/** "SAR 2,500 · USD 670", or null when no price is set. */
export function formatPriceFrom(
  price: PriceFrom | null,
  locale: string
): string | null {
  if (!price) return null;
  const fmt = (n: number, currency: string): string =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  const parts = [
    price.sar !== null ? fmt(price.sar, "SAR") : null,
    price.usd !== null ? fmt(price.usd, "USD") : null,
  ].filter((p): p is string => p !== null);
  return parts.length ? parts.join(" · ") : null;
}
