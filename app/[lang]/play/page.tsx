import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDictionary } from "../dictionaries";
import { PlayView } from "@/components/game/play-view";
import { isLocale, type Locale } from "@/lib/i18n";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);

  return createMetadata({
    locale,
    path: "/play",
    title: dict.meta.play.title,
    description: dict.meta.play.description,
    siteName: dict.meta.siteName,
  });
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);

  return (
    <main
      id="main-content"
      className="bg-background relative h-screen w-full overflow-hidden"
    >
      <PlayView locale={locale} dict={dict} />
    </main>
  );
}
