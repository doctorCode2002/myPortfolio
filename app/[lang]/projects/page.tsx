import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDictionary } from "../dictionaries";
import { WorkExplorer, type WorkItem } from "@/components/work/work-explorer";
import { PROJECTS } from "@/lib/content/projects";
import {
  SERVICE_GROUPS,
  SERVICE_GROUP_OF,
  SERVICE_IDS,
  type ServiceId,
} from "@/lib/content/services";
import { isLocale, type Locale } from "@/lib/i18n";
import { absoluteUrl, createMetadata } from "@/lib/metadata";
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
    path: "/projects",
    title: dict.meta.projects.title,
    description: dict.meta.projects.description,
    siteName: dict.meta.siteName,
  });
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);
  const w = dict.workPage;
  const studio = dict.studio;

  const serviceLabels = Object.fromEntries(
    SERVICE_IDS.map((id) => [id, studio.services.items[id].title])
  ) as Record<ServiceId, string>;

  const items: WorkItem[] = PROJECTS.map((p, i) => ({
    id: p.id,
    number: String(i + 1).padStart(2, "0"),
    title: dict.projects.items[p.id].title,
    description: dict.projects.items[p.id].description,
    category: studio.projects.categories[p.id],
    image: p.image,
    href: p.href,
    year: p.year,
    stack: p.frameworks,
    services: p.services.map((id) => ({ id, label: serviceLabels[id] })),
    groups: [...new Set(p.services.map((id) => SERVICE_GROUP_OF[id]))],
    featured: p.featured === true,
    caseStudy: w.cases[p.id],
  }));

  const groups = SERVICE_GROUPS.map((id) => ({
    id,
    label: studio.services.groups[id].title,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: dict.meta.projects.title,
    url: absoluteUrl(locale, "/projects"),
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "CreativeWork",
        name: p.title,
        description: p.description,
        url: p.href,
        dateCreated: p.year,
        creator: { "@id": "https://mohammedabutaleb.com/#person" },
      },
    })),
  };

  return (
    <PageTransition>
      <main id="main-content" className="flex flex-1 flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />

        <section className="px-5 pt-36 sm:px-10 sm:pt-48">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8">
                <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
                  (01) {w.eyebrow}
                </p>
                <h1 className="font-display mt-6 text-[clamp(3.6rem,11vw,10rem)] leading-[0.88] tracking-[-0.035em]">
                  {w.headlineA}{" "}
                  <span className="text-ember italic">{w.headlineAccent}</span>
                </h1>
              </div>
              <p className="text-foreground/65 max-w-[44ch] text-[16px] leading-[1.6] sm:text-[17px] lg:col-span-4 lg:justify-self-end">
                {w.lead}
              </p>
            </div>

            <div className="mt-16 sm:mt-20">
              <WorkExplorer
                items={items}
                groups={groups}
                serviceLabels={serviceLabels}
                copy={{
                  featured: w.featured,
                  index: w.index,
                  filter: w.filter,
                  columns: w.columns,
                  caseStudy: w.caseStudy,
                  empty: w.empty,
                  visit: studio.projects.visit,
                  opensInNewTab: studio.projects.opensInNewTab,
                }}
              />
            </div>

            <div className="flex flex-wrap items-end justify-between gap-8 py-24 sm:py-32">
              <div>
                <h2 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.03em]">
                  {w.closing.title}
                </h2>
                <p className="text-foreground/65 mt-4 max-w-[44ch] text-[16px] leading-[1.6]">
                  {w.closing.body}
                </p>
              </div>
              <a
                href="#contact"
                className="bg-ember text-ember-foreground inline-flex items-center gap-3 rounded-full px-7 py-4 text-[15px] font-medium transition-transform hover:-translate-y-0.5"
              >
                {w.closing.cta} <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
        </section>
      </main>
    </PageTransition>
  );
}
