import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDictionary } from "../dictionaries";
import { AboutCta } from "@/components/about/about-cta";
import { AboutHero } from "@/components/about/about-hero";
import { Approach } from "@/components/about/approach";
import { Disciplines } from "@/components/about/disciplines";
import { Education } from "@/components/about/education";
import { Experience } from "@/components/about/experience";
import { SectionLabel } from "@/components/about/section-label";
import { Skills } from "@/components/about/skills";
import { Stack } from "@/components/about/stack";
import { Story } from "@/components/about/story";
import { AboutTestimonials } from "@/components/about/testimonials";
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
    path: "/about",
    title: dict.meta.about.title,
    description: dict.meta.about.description,
    siteName: dict.meta.siteName,
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);
  const a = dict.aboutStudio;

  return (
    <PageTransition>
      <main id="main-content" className="flex flex-1 flex-col">
        <AboutHero dict={dict} />
        <Disciplines dict={dict} locale={locale} />
        <Story dict={dict} />
        <Approach dict={dict} />

        <section
          aria-label={a.labels.experience}
          className="px-5 pt-28 sm:px-10 sm:pt-40"
        >
          <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <SectionLabel index={5}>
                {a.labels.experience} / {a.labels.education}
              </SectionLabel>
            </div>
            <div className="grid gap-16 lg:col-span-9 xl:grid-cols-2 xl:gap-12">
              <Experience dict={dict} />
              <Education dict={dict} />
            </div>
          </div>
        </section>

        <section
          aria-label={a.labels.toolkit}
          className="px-5 pt-28 sm:px-10 sm:pt-40"
        >
          <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <SectionLabel index={6}>{a.labels.toolkit}</SectionLabel>
            </div>
            <div className="grid gap-16 lg:col-span-9 xl:grid-cols-2 xl:gap-12">
              <Skills dict={dict} />
              <Stack dict={dict} />
            </div>
          </div>
        </section>

        <AboutTestimonials dict={dict} index={7} />
        <AboutCta dict={dict} locale={locale} />
      </main>
    </PageTransition>
  );
}
