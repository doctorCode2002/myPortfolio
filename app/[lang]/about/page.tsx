import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDictionary } from "../dictionaries";
import { Education } from "@/components/about/education";
import { Experience } from "@/components/about/experience";
import { PolaroidStrip } from "@/components/about/polaroid-strip";
import { Skills } from "@/components/about/skills";
import { Stack } from "@/components/about/stack";
import { ContactCard } from "@/components/contact/contact-card";
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

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-312 pt-40 sm:pt-56">
        <PolaroidStrip dict={dict} />
      </section>

      <section className="mx-auto w-full max-w-160 px-6 pt-20 pb-16 sm:px-10 sm:pt-28 sm:pb-24">
        <FadeIn delay={0.5}>
          <div className="rounded-4xl border border-foreground/10 bg-muted/40 p-8 sm:p-12">
            <h1 className="font-serif text-[1.75rem] font-medium text-foreground sm:text-[2rem]">
              {dict.aboutPage.greeting}{" "}
              <span className="border-b border-accent/50 pb-0.5">
                {dict.aboutPage.name}
              </span>
              .
            </h1>
            <div className="mt-8 space-y-6 text-[17px] leading-[1.7] text-muted-foreground sm:text-[18px]">
              <p>{dict.aboutPage.bio1}</p>
              <p>{dict.aboutPage.bio2}</p>
              <p>{dict.aboutPage.bio3}</p>
              <p>{dict.aboutPage.bio4}</p>
            </div>
          </div>
        </FadeIn>
      </section>

      <section className="mx-auto w-full max-w-160 px-6 pb-20 sm:px-10 sm:pb-28">
        <FadeIn delay={0.1}>
          <div className="flex flex-col gap-10">
            <Experience dict={dict} />
            <Education dict={dict} />
            <Skills dict={dict} />
            <Stack dict={dict} />
          </div>
        </FadeIn>
      </section>

      <ContactCard locale={locale} dict={dict} />
      <div className="h-12 sm:h-16" />
    </main>
  );
}
