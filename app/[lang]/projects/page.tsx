import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDictionary } from "../dictionaries";
import { ContactCard } from "@/components/contact/contact-card";
import { Projects } from "@/components/projects/projects";
import { FadeIn } from "@/components/ui/motion-primitives";
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
    path: "/projects",
    title: dict.meta.projects.title,
    description: dict.meta.projects.description,
    siteName: dict.meta.siteName,
  });
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-275 px-6 pt-44 pb-16 sm:px-10 sm:pt-56 sm:pb-20">
        <FadeIn className="flex flex-col items-center gap-5 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
            {dict.projects.eyebrow}
          </p>
          <h1 className="font-serif text-[2.75rem] font-medium leading-[1.05] text-foreground md:text-[3.25rem] lg:text-[3.75rem]">
            {dict.projects.headlineAll}
          </h1>
          <p className="max-w-[38ch] text-[20px] leading-[1.4] text-muted-foreground sm:text-[22px]">
            {dict.projects.subAll}
          </p>
        </FadeIn>
      </section>

      <Projects locale={locale} dict={dict} />
      <ContactCard locale={locale} dict={dict} />
      <div className="h-12 sm:h-16" />
    </main>
  );
}
