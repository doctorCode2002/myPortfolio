/**
 * ARABIC IS CURRENTLY DISABLED — English only.
 *
 * To switch Arabic back on, this is the whole job:
 *   1. Uncomment `"ar"` below.
 *   2. Uncomment the `ar` entries in HTML_LANG / OG_LOCALE / LOCALE_LABEL.
 *   3. Uncomment the two Arabic fonts in app/[lang]/layout.tsx.
 *
 * Everything else follows automatically: routes, generateStaticParams, the
 * sitemap, hreflang alternates, the Accept-Language redirect in proxy.ts, and
 * the language switch in the nav all read from this array. The Arabic
 * translations (app/dictionaries/ar.json) and the RTL rules in globals.css are
 * untouched and stay shape-checked — see getArabicDictionary().
 */
export const LOCALES = [
  "en",
  // "ar",
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Locales that render right-to-left, independent of which are enabled. */
const RTL_LOCALES: readonly string[] = ["ar"];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return isRtl(locale) ? "rtl" : "ltr";
}

/** Prefix an app-relative path with its locale segment: ("ar", "/projects") -> "/ar/projects". */
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
  // ar: "ar",
};

/** OpenGraph locale identifiers. */
export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  // ar: "ar_AR",
};

/** Native names, used by the language switch. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "EN",
  // ar: "ع",
};
