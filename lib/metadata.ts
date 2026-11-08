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
      "logo design",
      "visual identity",
      "video editing",
      "web development",
      "mobile app development",
      "UI/UX design",
      "AI automation",
      "Next.js developer",
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
    // Google Search Console "HTML tag" verification. Set the token from
    // Search Console as GOOGLE_SITE_VERIFICATION in Vercel; with no token the
    // tag is omitted (DNS verification needs no code at all).
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
      : {}),
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

/**
 * Site-wide structured data: a ProfilePage about the Person, plus the
 * Organization (the studio) and the services it offers. Organization rather
 * than ProfessionalService/LocalBusiness, which require a published street
 * address. Service names come from the dictionary so each locale is localized.
 */
export function profileJsonLd(
  locale: Locale,
  services: readonly string[] = []
): string {
  const url = absoluteUrl(locale);
  const person = {
    "@type": "Person",
    "@id": `${siteConfig.url}/#person`,
    name: PERSON.name,
    jobTitle: PERSON.jobTitle,
    url,
    sameAs: [...PERSON.sameAs],
    knowsAbout: [...PERSON.knowsAbout],
  };
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        inLanguage: locale,
        url,
        mainEntity: { "@id": person["@id"] },
      },
      person,
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#studio`,
        name: PERSON.name,
        url,
        founder: { "@id": person["@id"] },
        areaServed: ["SA", "AE", "KW", "QA", "BH", "OM", "Worldwide"],
        makesOffer: services.map((name) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name,
            provider: { "@id": `${siteConfig.url}/#studio` },
          },
        })),
      },
    ],
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
