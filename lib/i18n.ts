/**
 * The site is English-only. Arabic was retired in November 2026; old /ar/...
 * URLs are permanently redirected to their English pages by proxy.ts.
 *
 * Routes, generateStaticParams, the sitemap and hreflang alternates all read
 * from LOCALES, so adding a locale back starts here (plus its dictionaries).
 */
export const LOCALES = ["en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Locales that render right-to-left, independent of which are enabled. */
const RTL_LOCALES: readonly string[] = [];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return isRtl(locale) ? "rtl" : "ltr";
}

/** Prefix an app-relative path with its locale segment: ("en", "/projects") -> "/en/projects". */
export function localePath(locale: Locale, path: string): string {
  if (path === "/" || path === "") return `/${locale}`;
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Swap the leading locale segment of a pathname, keeping the rest of the route.
 * "/ar/mentoring" + "en" -> "/en/mentoring". Used by the language switch so
 * changing language never sends the reader back to the home page.
 */
export function switchLocalePath(pathname: string, next: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first !== undefined && isLocale(first)) {
    segments[0] = next;
    return `/${segments.join("/")}`;
  }
  return localePath(next, pathname);
}

/** BCP 47 tags for <html lang> and hreflang. */
export const HTML_LANG: Record<Locale, string> = {
  en: "en",
};

/** OpenGraph locale identifiers. */
export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
};

/** Native names, used by the language switch. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "EN",
};
