import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { getDictionary, type Dictionary } from "../dictionaries";
import { PillarNav } from "@/components/services/pillar-nav";
import {
  ENGAGEMENT_PRICE_FROM,
  PRICE_FROM,
  formatPriceFrom,
} from "@/components/services/pricing";
import { PROJECTS } from "@/lib/content/projects";
import {
  SERVICE_GROUPS,
  serviceNumber,
  servicesIn,
  type ServiceGroup,
  type ServiceId,
} from "@/lib/content/services";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
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
    path: "/services",
    title: dict.meta.services.title,
    description: dict.meta.services.description,
    siteName: dict.meta.siteName,
  });
}

const PROCESS_STEPS = ["call", "scope", "build", "launch"] as const;
const TRUST_POINTS = ["baseline", "human", "data", "person"] as const;
const ENGAGEMENTS = ["project", "retainer"] as const;

function groupNumber(g: ServiceGroup): string {
  return `0${SERVICE_GROUPS.indexOf(g) + 1}`;
}

function servicesJsonLd(locale: Locale, dict: Dictionary): string {
  const url = absoluteUrl(locale, "/services");
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: dict.servicesPage.breadcrumbHome,
            item: absoluteUrl(locale),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: dict.meta.services.title,
            item: url,
          },
        ],
      },
      {
        "@type": "ItemList",
        name: dict.meta.services.title,
        itemListElement: SERVICE_GROUPS.flatMap((g) => servicesIn(g)).map(
          (id, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Service",
              name: dict.studio.services.items[id].title,
              description: dict.studio.services.items[id].body,
              serviceType:
                dict.studio.services.groups[
                  SERVICE_GROUPS.find((g) => servicesIn(g).includes(id))!
                ].title,
              provider: { "@id": "https://mohammedabutaleb.com/#studio" },
              areaServed: ["SA", "AE", "KW", "QA", "BH", "OM", "Worldwide"],
              url: `${url}#${id}`,
            },
          })
        ),
      },
    ],
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);
  const t = dict.servicesPage;
  const studio = dict.studio;

  const pillars = SERVICE_GROUPS.map((g) => ({
    id: g,
    title: studio.services.groups[g].title,
    number: groupNumber(g),
  }));

  return (
    <PageTransition>
      <main id="main-content" className="flex flex-1 flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: servicesJsonLd(locale, dict) }}
        />

        {/* ------------------------------------------------------------ hero */}
        <section className="px-5 pt-36 pb-20 sm:px-10 sm:pt-44 sm:pb-28">
          <div className="mx-auto max-w-[1440px]">
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
              {t.eyebrow}
            </p>
            <h1 className="font-display mt-6 text-[clamp(3rem,9vw,9rem)] leading-[0.9] tracking-[-0.035em]">
              {t.headlineA}
              <br />
              <span className="text-foreground/85 italic">{t.headlineB}</span>
            </h1>

            <div className="border-line mt-14 grid gap-10 border-t pt-8 lg:grid-cols-12 lg:gap-8">
              <p className="text-foreground/70 max-w-[56ch] text-[17px] leading-[1.6] lg:col-span-6">
                {t.intro}
              </p>
              <div className="lg:col-span-5 lg:col-start-8">
                <h2 className="font-heading text-[20px] font-medium tracking-[-0.01em]">
                  <span
                    className="bg-ember me-3 inline-block size-1.5 -translate-y-1 rounded-full"
                    aria-hidden="true"
                  />
                  {t.oneTeam.title}
                </h2>
                <p className="text-muted-foreground mt-3 text-[15px] leading-[1.65]">
                  {t.oneTeam.body}
                </p>
              </div>
            </div>

            {/* Pillar index — the quick way in on small screens. */}
            <nav aria-label={t.pillarNav} className="mt-14 lg:hidden">
              <ul className="border-line bg-line grid grid-cols-2 gap-px overflow-hidden rounded-2xl border">
                {pillars.map((p) => (
                  <li key={p.id}>
                    <a
                      href={`#${p.id}`}
                      className="bg-background hover:bg-surface flex h-full flex-col gap-2 p-5 transition-colors"
                    >
                      <span className="text-ember font-mono text-[10px] tracking-[0.2em]">
                        {p.number}
                      </span>
                      <span className="font-display text-[28px] leading-none">
                        {p.title}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>

        {/* --------------------------------------------------------- pillars */}
        <div className="px-5 sm:px-10">
          <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-12 lg:gap-8">
            <aside className="hidden lg:col-span-3 lg:block">
              <PillarNav label={t.pillarNav} items={pillars} />
            </aside>

            <div className="lg:col-span-9">
              {SERVICE_GROUPS.map((g) => (
                <Pillar key={g} group={g} dict={dict} locale={locale} />
              ))}
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------- process */}
        <section
          aria-labelledby="process-heading"
          className="px-5 pt-28 sm:px-10 sm:pt-40"
        >
          <div className="mx-auto max-w-[1440px]">
            <SectionHead
              eyebrow={t.process.eyebrow}
              id="process-heading"
              title={t.process.title}
            />
            <ol className="border-line bg-line mt-14 grid gap-px overflow-hidden rounded-[24px] border sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS_STEPS.map((k, i) => (
                <li key={k} className="bg-background flex flex-col p-7 sm:p-8">
                  <span className="font-display text-ember text-[64px] leading-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-heading mt-10 text-[20px] font-medium tracking-[-0.01em]">
                    {t.process.steps[k].title}
                  </h3>
                  <p className="text-muted-foreground mt-3 text-[15px] leading-[1.6]">
                    {t.process.steps[k].body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------ engagement */}
        <section
          aria-labelledby="engagement-heading"
          className="px-5 pt-28 sm:px-10 sm:pt-40"
        >
          <div className="mx-auto max-w-[1440px]">
            <SectionHead
              eyebrow={t.engagement.eyebrow}
              id="engagement-heading"
              title={t.engagement.title}
            />
            <div className="mt-14 grid gap-4 md:grid-cols-2">
              {ENGAGEMENTS.map((k) => {
                const e = t.engagement.types[k];
                const price = formatPriceFrom(ENGAGEMENT_PRICE_FROM[k], locale);
                return (
                  <article
                    key={k}
                    className="border-line bg-surface flex flex-col rounded-[24px] border p-7 sm:p-10"
                  >
                    <h3 className="font-display text-[clamp(2.2rem,4vw,3.25rem)] leading-none tracking-[-0.02em]">
                      {e.title}
                    </h3>
                    <p className="text-foreground/70 mt-5 max-w-[48ch] text-[16px] leading-[1.6]">
                      {e.body}
                    </p>
                    <p className="text-muted-foreground mt-auto pt-10 font-mono text-[11px] tracking-[0.16em] uppercase">
                      {e.bestFor}
                    </p>
                    {price ? (
                      <p className="text-ember mt-3 font-mono text-[13px]">
                        {t.labels.from} {price}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
            <p className="text-muted-foreground mt-6 max-w-[70ch] text-[15px] leading-[1.6]">
              {t.engagement.pricingNote}
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------- not do + FAQ */}
        <section className="px-5 pt-28 sm:px-10 sm:pt-40">
          <div className="mx-auto grid max-w-[1440px] gap-16 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-4">
              <SectionHead
                eyebrow={t.notDo.eyebrow}
                id="notdo-heading"
                title={t.notDo.title}
                small
              />
              <ul
                aria-labelledby="notdo-heading"
                className="border-line mt-10 flex flex-col border-t"
              >
                {t.notDo.items.map((item) => (
                  <li
                    key={item}
                    className="border-line text-foreground/75 flex gap-4 border-b py-4 text-[15px] leading-[1.55]"
                  >
                    <span
                      className="bg-ember mt-[0.55em] h-px w-3 shrink-0"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7 lg:col-start-6">
              <SectionHead
                eyebrow={t.faq.eyebrow}
                id="faq-heading"
                title={t.faq.title}
                small
              />
              <div className="border-line mt-10 border-t">
                {t.faq.items.map((f) => (
                  <details key={f.q} className="group border-line border-b">
                    <summary className="hover:text-ember flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[18px] font-medium tracking-[-0.01em] transition-colors [&::-webkit-details-marker]:hidden">
                      <span className="font-heading">{f.q}</span>
                      <span
                        aria-hidden="true"
                        className="relative size-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-current after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-current after:transition-transform group-open:after:scale-y-0"
                      />
                    </summary>
                    <p className="text-muted-foreground max-w-[62ch] pb-7 text-[16px] leading-[1.65]">
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- CTA */}
        <section className="px-5 py-28 sm:px-10 sm:py-40">
          <div className="border-line bg-surface mx-auto flex max-w-[1440px] flex-col items-start gap-8 rounded-[28px] border p-8 sm:p-14 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-[clamp(2.4rem,5.5vw,4.75rem)] leading-[0.95] tracking-[-0.03em]">
                {t.cta.title}
              </h2>
              <p className="text-foreground/65 mt-5 max-w-[48ch] text-[16px] leading-[1.6]">
                {t.cta.body}
              </p>
            </div>
            <a
              href="#contact"
              className="group bg-ember text-ember-foreground hover:bg-foreground inline-flex shrink-0 items-center gap-3 rounded-full px-7 py-4 text-[15px] font-medium transition-colors"
            >
              {t.cta.button}
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
              >
                →
              </span>
            </a>
          </div>
        </section>
      </main>
    </PageTransition>
  );
}

function SectionHead({
  eyebrow,
  title,
  id,
  small = false,
}: {
  eyebrow: string;
  title: string;
  id: string;
  small?: boolean;
}): ReactNode {
  return (
    <div>
      <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`font-display mt-5 leading-[0.95] tracking-[-0.03em] ${
          small
            ? "text-[clamp(2.4rem,4.5vw,4rem)]"
            : "text-[clamp(2.6rem,6.4vw,6rem)]"
        }`}
      >
        {title}
      </h2>
    </div>
  );
}

function Pillar({
  group,
  dict,
  locale,
}: {
  group: ServiceGroup;
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const t = dict.servicesPage;
  const g = dict.studio.services.groups[group];
  const ids = servicesIn(group);

  return (
    <section
      id={group}
      aria-labelledby={`${group}-heading`}
      className="border-line scroll-mt-28 border-t py-16 first:border-t-0 first:pt-0 sm:py-24"
    >
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-ember font-mono text-[11px] tracking-[0.22em]">
            {groupNumber(group)}
          </p>
          <h2
            id={`${group}-heading`}
            className="font-display mt-3 text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] tracking-[-0.035em]"
          >
            {g.title}
          </h2>
        </div>
        <p className="font-display text-foreground/55 max-w-[24ch] text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.1] italic">
          {g.outcome}
        </p>
      </header>

      <div className="mt-12 flex flex-col">
        {ids.map((id) => (
          <ServiceRow key={id} id={id} dict={dict} locale={locale} />
        ))}
      </div>

      {group === "automation" ? (
        <div className="border-line bg-surface mt-12 rounded-[24px] border p-7 sm:p-10">
          <h3 className="font-display text-[clamp(2rem,3.6vw,3rem)] leading-none tracking-[-0.02em]">
            {t.trust.title}
          </h3>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2">
            {TRUST_POINTS.map((k) => (
              <li key={k}>
                <h4 className="font-heading flex items-center gap-3 text-[17px] font-medium">
                  <span
                    className="bg-ember size-1.5 rounded-full"
                    aria-hidden="true"
                  />
                  {t.trust.points[k].title}
                </h4>
                <p className="text-muted-foreground mt-2 text-[15px] leading-[1.6]">
                  {t.trust.points[k].body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ServiceRow({
  id,
  dict,
  locale,
}: {
  id: ServiceId;
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const t = dict.servicesPage;
  const s = dict.studio.services.items[id];
  const detail = t.items[id];
  const related = PROJECTS.filter((p) => p.services.includes(id));
  const price = formatPriceFrom(PRICE_FROM[id], locale);

  return (
    <article
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-line grid scroll-mt-28 gap-8 border-t py-10 md:grid-cols-12 md:gap-8"
    >
      <div className="md:col-span-5">
        <div className="flex items-baseline gap-4">
          <span className="text-muted-foreground font-mono text-[11px]">
            {serviceNumber(id)}
          </span>
          <h3
            id={`${id}-title`}
            className="font-heading text-[24px] leading-tight font-medium tracking-[-0.01em] sm:text-[28px]"
          >
            {s.title}
          </h3>
        </div>
        <p className="text-foreground/65 mt-4 max-w-[46ch] text-[15px] leading-[1.6]">
          {s.body}
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {s.tags.map((tag) => (
            <li
              key={tag}
              className="border-line text-muted-foreground rounded-full border px-3 py-1 font-mono text-[10.5px] tracking-[0.12em] uppercase"
            >
              {tag}
            </li>
          ))}
        </ul>
        {price ? (
          <p className="text-ember mt-5 font-mono text-[13px]">
            {t.labels.from} {price}
          </p>
        ) : null}
      </div>

      <div className="md:col-span-4">
        <h4 className="text-muted-foreground font-mono text-[10.5px] tracking-[0.2em] uppercase">
          {t.labels.deliverables}
        </h4>
        <ul className="mt-4 flex flex-col gap-2.5">
          {detail.deliverables.map((d) => (
            <li
              key={d}
              className="text-foreground/80 flex gap-3 text-[15px] leading-[1.5]"
            >
              <span
                className="bg-ember mt-[0.6em] h-px w-3 shrink-0"
                aria-hidden="true"
              />
              {d}
            </li>
          ))}
        </ul>
      </div>

      <dl className="flex flex-col gap-6 md:col-span-3">
        <div>
          <dt className="text-muted-foreground font-mono text-[10.5px] tracking-[0.2em] uppercase">
            {t.labels.timeline}
          </dt>
          <dd className="font-display mt-2 text-[30px] leading-none">
            {detail.timeline}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-mono text-[10.5px] tracking-[0.2em] uppercase">
            {t.labels.relatedWork}
          </dt>
          <dd className="mt-3">
            {related.length ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {related.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`${localePath(locale, "/projects")}?service=${id}`}
                      className="text-foreground/80 decoration-foreground/25 hover:text-ember hover:decoration-ember text-[14px] underline underline-offset-[5px] transition-colors"
                    >
                      {dict.projects.items[p.id].title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground text-[14px]">
                {t.labels.noWork}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </article>
  );
}
