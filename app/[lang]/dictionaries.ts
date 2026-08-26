import type { Locale } from "@/lib/i18n";

/**
 * Dynamic imports so only the requested locale's strings are pulled into the
 * server render. Both files must have identical key shapes — `Dictionary` is
 * derived from the English file, so a missing or renamed key in ar.json is a
 * type error rather than an `undefined` on the page.
 */
const dictionaries = {
  en: () => import("../dictionaries/en.json").then((m) => m.default),
  ar: () => import("../dictionaries/ar.json").then((m) => m.default),
} as const;

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}

/**
 * Arabic is currently switched off in lib/i18n.ts, so `Locale` no longer
 * includes it and nothing routes here. This exists to keep ar.json's shape
 * checked against en.json — the `Promise<Dictionary>` return type makes a
 * missing or renamed Arabic key a type error, so the translations can't rot
 * while they're dormant. Delete it only if you drop Arabic for good.
 */
export async function getArabicDictionary(): Promise<Dictionary> {
  return dictionaries.ar();
}

/** Fill `{name}` placeholders in a dictionary string. */
export function interpolate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
