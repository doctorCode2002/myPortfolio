import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDictionary } from "./dictionaries";
import { HomeHero } from "@/components/home/hero";
import { ServicesMarquee } from "@/components/home/marquee";
import { ServicePillars } from "@/components/home/pillars";
import { SelectedWork } from "@/components/home/selected-work";
import { HomeTeasers } from "@/components/home/teasers";
import { HomeTestimonials } from "@/components/home/testimonials";
import { HomeWorkflow } from "@/components/home/workflow";
import { SERVICE_IDS } from "@/lib/content/services";
import { isLocale, type Locale } from "@/lib/i18n";
import { createMetadata } from "@/lib/metadata";
import { PageTransition } from "@/components/site/page-transition";

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

/**
 * Home, work-first: hero → marquee → selected work → four service pillars →
 * AI workflow (swarm) → testimonials → About / Mentoring. The contact close
 * and footer come from the root layout.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);
  const serviceTitles = SERVICE_IDS.map(
    (id) => dict.studio.services.items[id].title
  );

  return (
    <PageTransition>
      <main id="main-content" className="flex flex-1 flex-col overflow-x-clip">
        <HomeHero locale={locale} dict={dict} />
        <ServicesMarquee items={serviceTitles} />
        <SelectedWork locale={locale} dict={dict} />
        <ServicePillars locale={locale} dict={dict} />
        <HomeWorkflow dict={dict} />
        <HomeTestimonials dict={dict} />
        <HomeTeasers locale={locale} dict={dict} />
      </main>
    </PageTransition>
  );
}
