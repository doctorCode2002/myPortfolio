import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDictionary } from "./dictionaries";
import { ContactCard } from "@/components/contact/contact-card";
import { Hero } from "@/components/hero/hero";
import { Services } from "@/components/home/services";
import { Testimonials } from "@/components/home/testimonials";
import { Projects } from "@/components/projects/projects";
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
    path: "/",
    title: dict.meta.home.title,
    description: dict.meta.home.description,
    siteName: dict.meta.siteName,
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <Hero locale={locale} dict={dict} />
      <Services dict={dict} />
      <Projects locale={locale} dict={dict} featured />
      <Testimonials dict={dict} />
      <ContactCard locale={locale} dict={dict} />
      <div className="h-12 sm:h-16" />
    </main>
  );
}
