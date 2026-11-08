import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Instrument_Serif,
  Inter_Tight,
} from "next/font/google";
import type { ReactNode } from "react";

import { getDictionary } from "./dictionaries";
import { Providers } from "@/components/layout/providers";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { Grain } from "@/components/site/grain";
import { HEAD_SCRIPT, IntroLoader } from "@/components/site/intro-loader";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
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
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

const FONT_VARS = [geistSans, geistMono, instrument, interTight]
  .map((f) => f.variable)
  .join(" ");

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  colorScheme: "dark",
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
  const s = dict.studio;
  const introWords = Object.values(s.services.groups).map((g) => g.title);

  return (
    <html
      lang={HTML_LANG[locale]}
      dir={dirFor(locale)}
      suppressHydrationWarning
      className={FONT_VARS}
    >
      <head>
        {/* Motion preference + whether the intro plays, decided before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: profileJsonLd(
              locale,
              Object.values(s.services.items).map((i) => i.title)
            ),
          }}
        />
        <Providers>
          <SkipToContent label={s.nav.skipToContent} />
          <IntroLoader
            labels={s.loader}
            words={introWords}
            name={s.brand.name}
          />
          <SiteHeader locale={locale} studio={s} />
          {children}
          <SiteFooter studio={s} />
          <Grain />
        </Providers>
      </body>
    </html>
  );
}
