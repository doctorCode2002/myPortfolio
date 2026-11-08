import type { Locale } from "@/lib/i18n";

/**
 * One dictionary per locale, assembled from:
 *   ../dictionaries/<locale>.json          legacy keys (meta, about, mentoring, projects…)
 *   ../dictionaries/<locale>/studio.json   shared Obsidian chrome + service catalogue
 *   ../dictionaries/<locale>/<page>.json   page-specific copy (home, services, work, about)
 *
 * Split by page so each page's copy can change without touching the others.
 * `Dictionary` is derived from the English files.
 */

async function loadEn() {
  const [base, studio, home, services, work, about] = await Promise.all([
    import("../dictionaries/en.json"),
    import("../dictionaries/en/studio.json"),
    import("../dictionaries/en/home.json"),
    import("../dictionaries/en/services.json"),
    import("../dictionaries/en/work.json"),
    import("../dictionaries/en/about.json"),
  ]);
  return {
    ...base.default,
    studio: studio.default,
    home: home.default,
    servicesPage: services.default,
    workPage: work.default,
    aboutStudio: about.default,
  };
}

export type Dictionary = Awaited<ReturnType<typeof loadEn>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  void locale; // English is the only locale.
  return loadEn();
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
