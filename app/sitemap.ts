import type { MetadataRoute } from "next";

import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/metadata";

const ROUTES = [
  { path: "/", priority: 1 },
  { path: "/projects", priority: 0.9 },
  { path: "/about", priority: 0.8 },
  { path: "/mentoring", priority: 0.8 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(locale, route.path),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: route.priority,
      alternates: {
        languages: Object.fromEntries([
          ...LOCALES.map((l) => [l, absoluteUrl(l, route.path)]),
          ["x-default", absoluteUrl(DEFAULT_LOCALE, route.path)],
        ]) as Record<string, string>,
      },
    }))
  );
}
