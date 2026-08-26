import type { Metadata, Viewport } from "next";
// IBM_Plex_Sans_Arabic and Noto_Kufi_Arabic are re-imported when Arabic is
// switched back on — see the commented block below.
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { getDictionary } from "./dictionaries";
import { Nav } from "@/components/layout/nav";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { Providers } from "@/components/layout/providers";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { HTML_LANG, LOCALES, dirFor, isLocale, type Locale } from "@/lib/i18n";
import { createMetadata, profileJsonLd } from "@/lib/metadata";
import "../globals.css";

export const dynamicParams = false;

export function generateStaticParams(): { lang: Locale }[] {
  return LOCALES.map((lang) => ({ lang }));
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

// Arabic is disabled (see lib/i18n.ts). These stay commented out rather than
// merely unused: next/font downloads and self-hosts every face it is given, so
// leaving them active would ship two Arabic families no page ever renders.
// Uncomment both, and their entries in FONT_VARS, when Arabic comes back.
//
// const plexArabic = IBM_Plex_Sans_Arabic({
//   variable: "--font-plex-arabic",
//   subsets: ["arabic", "latin"],
//   weight: ["300", "400", "500", "600", "700"],
//   display: "swap",
// });
//
// const kufiArabic = Noto_Kufi_Arabic({
//   variable: "--font-kufi-arabic",
//   subsets: ["arabic"],
//   display: "swap",
// });

const FONT_VARS = [
  geistSans.variable,
  geistMono.variable,
  fraunces.variable,
  // plexArabic.variable,
  // kufiArabic.variable,
].join(" ");

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2e9" },
    { media: "(prefers-color-scheme: dark)", color: "#14110f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);

  return {
    ...createMetadata({
      locale,
      path: "/",
      title: dict.meta.home.title,
      description: dict.meta.description,
      siteName: dict.meta.siteName,
    }),
    title: {
      default: `${dict.meta.siteName} | ${dict.meta.role}`,
      template: `%s | ${dict.meta.siteName}`,
    },
    // No explicit `icons` block: app/icon.svg and app/apple-icon.tsx are picked
    // up by file convention, so the tags can never point at a missing file.
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang } = await params;
  // dynamicParams = false guarantees `lang` is one of LOCALES; the guard exists
  // to narrow the type, not to handle a reachable case.
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);

  return (
    <html
      lang={HTML_LANG[locale]}
      dir={dirFor(locale)}
      suppressHydrationWarning
      className={FONT_VARS}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: profileJsonLd(locale) }}
        />
        <Providers>
          <div className="site-frame site-frame--top" aria-hidden="true" />
          <div className="site-frame site-frame--left" aria-hidden="true" />
          <div className="site-frame site-frame--right" aria-hidden="true" />
          <CornerGlyph className="site-corner site-corner--top-left" />
          <CornerGlyph className="site-corner site-corner--top-right" />

          <SkipToContent label={dict.nav.skipToContent} />
          <PageBackdrop />
          <Nav locale={locale} labels={dict.nav} />
          {children}
        </Providers>
      </body>
    </html>
  );
}

function CornerGlyph({ className }: { className: string }): ReactNode {
  return (
    <svg
      className={className}
      width="50"
      height="50"
      viewBox="0 0 50 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5.50871e-06 0C-0.00788227 37.3001 8.99616 50.0116 50 50H5.50871e-06V0Z"
        fill="currentColor"
      />
    </svg>
  );
}
