import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { SectionHeading } from "./section-heading";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import SpotlightCard from "@/components/vendor/reactbits/SpotlightCard";
import { PROJECTS, type Project } from "@/lib/content/projects";
import { SERVICE_GROUP_OF } from "@/lib/content/services";
import { localePath, type Locale } from "@/lib/i18n";

/** How many non-featured projects follow the two featured ones. */
const MORE = 4;

function groupsOf(p: Project): string[] {
  return [...new Set(p.services.map((s) => SERVICE_GROUP_OF[s]))];
}

function WorkCard({
  p,
  big,
  dict,
}: {
  p: Project;
  big: boolean;
  dict: Dictionary;
}): ReactNode {
  const item = dict.projects.items[p.id];
  const groups = groupsOf(p).map(
    (g) =>
      dict.studio.services.groups[g as keyof typeof dict.studio.services.groups]
        .title
  );

  return (
    <SpotlightCard
      spotlightColor="rgba(255, 90, 31, 0.55)"
      intensity={0.22}
      spotlightSize={big ? 420 : 300}
      borderGlow={0.8}
      className="group h-full !rounded-[24px] !p-0"
      style={{ ["--spotlight-card-surface" as string]: "var(--surface)" }}
    >
      <a
        href={p.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full flex-col p-3 sm:p-4"
      >
        <div
          className={`bg-surface-2 relative aspect-video w-full overflow-hidden rounded-[16px]`}
        >
          <Image
            src={p.image}
            alt=""
            fill
            sizes={
              big
                ? "(min-width: 1024px) 50vw, 100vw"
                : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            }
            className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.2,.7,.1,1)] group-hover:scale-[1.04]"
          />
        </div>
        <div className="flex flex-1 flex-col px-2 pt-5 pb-2 sm:px-3">
          <div className="text-muted-foreground flex items-center justify-between gap-3 font-mono text-[10.5px] tracking-[0.18em] uppercase">
            <span>{dict.studio.projects.categories[p.id]}</span>
            <span dir="ltr">{p.year}</span>
          </div>
          <h3
            className={`font-display mt-3 flex items-baseline justify-between gap-4 leading-none tracking-[-0.02em] ${
              big ? "text-[clamp(2.4rem,4.5vw,4rem)]" : "text-[34px]"
            }`}
          >
            {item.title}
            <span
              className="text-ember text-[22px] opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
              aria-hidden="true"
            >
              ↗
            </span>
          </h3>
          {big ? (
            <p className="text-foreground/60 mt-4 max-w-[54ch] text-[15px] leading-[1.6]">
              {item.description}
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            {groups.map((g) => (
              <span
                key={g}
                className="border-line text-foreground/60 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.14em] uppercase"
              >
                {g}
              </span>
            ))}
          </div>
          <span className="sr-only">({dict.studio.contact.opensInNewTab})</span>
        </div>
      </a>
    </SpotlightCard>
  );
}

export function SelectedWork({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}): ReactNode {
  const w = dict.home.work;
  const featured = PROJECTS.filter((p) => p.featured);
  const rest = PROJECTS.filter((p) => !p.featured).slice(0, MORE);

  return (
    <section
      aria-labelledby="home-work"
      className="px-5 pt-24 sm:px-10 sm:pt-36"
    >
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          index="01"
          eyebrow={w.eyebrow}
          title={w.title}
          accent={w.titleAccent}
          id="home-work"
        >
          <div className="flex max-w-[36ch] flex-col items-start gap-5">
            <p className="text-muted-foreground text-[15px] leading-[1.6]">
              {w.body}
            </p>
            <Link
              href={localePath(locale, "/projects")}
              className="group hover:text-ember inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase transition-colors"
            >
              {w.all} ({PROJECTS.length})
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </SectionHeading>

        <ul className="mt-14 grid gap-4 lg:grid-cols-2">
          {featured.map((p) => (
            <li key={p.id}>
              <WorkCard p={p} big dict={dict} />
            </li>
          ))}
        </ul>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((p) => (
            <li key={p.id}>
              <WorkCard p={p} big={false} dict={dict} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
