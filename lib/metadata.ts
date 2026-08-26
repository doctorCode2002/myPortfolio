import type { Metadata } from "next";

import { PERSON } from "@/lib/content/contact";
import { DEFAULT_LOCALE, LOCALES, OG_LOCALE, type Locale } from "@/lib/i18n";

export const siteConfig = {
  url: "https://mohammedabutaleb.com",
  name: PERSON.name,
  handle: "@mohammedabu.taleb",
  keywords: {
    en: [
      "Mohammed Ashraf",
      "full-stack developer",
      "frontend instructor",
      "React developer",
      "Next.js",
      "Tailwind CSS",
      "GSAP",
      "portfolio",
    ],
    ar: [
      "محمد أشرف",
      "مطور ويب متكامل",
      "مدرب واجهات أمامية",
      "مطور React",
      "Next.js",
      "تطوير مواقع",
      "برمجة",
    ],
  },
} as const;

/** Absolute URL for a locale-prefixed path. */
export function absoluteUrl(locale: Locale, path = "/"): string {
  const suffix = path === "/" ? "" : path;
  return `${siteConfig.url}/${locale}${suffix}`;
}

/** hreflang map — every page advertises both locales plus an x-default. */
function languageAlternates(path: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const locale of LOCALES) {
    entries[locale] = absoluteUrl(locale, path);
  }
  entries["x-default"] = absoluteUrl(DEFAULT_LOCALE, path);
  return entries;
}

export function createMetadata({
  locale,
  path = "/",
  title,
  description,
  siteName,
  noIndex = false,
}: {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
  siteName: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(locale, path);

  return {
    metadataBase: new URL(siteConfig.url),
    title,
    description,
    keywords: [...siteConfig.keywords[locale]],
    authors: [{ name: PERSON.name, url: siteConfig.url }],
    creator: PERSON.name,
    publisher: PERSON.name,
    alternates: {
      canonical: url,
      languages: languageAlternates(path),
    },
    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map(
        (l) => OG_LOCALE[l]
      ),
      url,
      siteName,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    manifest: "/site.webmanifest",
    formatDetection: { telephone: false },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
  };
}

/** ProfilePage structured data, ported from the previous site's root layout. */
export function profileJsonLd(locale: Locale): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    inLanguage: locale,
    mainEntity: {
      "@type": "Person",
      name: PERSON.name,
      jobTitle: PERSON.jobTitle,
      url: absoluteUrl(locale),
      sameAs: [...PERSON.sameAs],
      knowsAbout: [...PERSON.knowsAbout],
    },
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
