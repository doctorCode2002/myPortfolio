import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { MonogramPanel } from "@/components/site/monogram-panel";

const FACT_ORDER = ["based", "since", "languages", "clients"] as const;

/**
 * Plain statement of who and what, beside a real photo. The headline is
 * server-rendered and visible on first paint (it is the page's LCP text).
 */
export function AboutHero({ dict }: { dict: Dictionary }): ReactNode {
  const a = dict.aboutStudio;
  return (
    <section
      aria-labelledby="about-heading"
      className="px-5 pt-32 sm:px-10 sm:pt-44"
    >
      <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-12 lg:items-end lg:gap-8">
        <div className="lg:col-span-7">
          <p className="text-muted-foreground mb-8 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] uppercase">
            <span
              className="bg-ember inline-block size-1.5 rounded-full"
              aria-hidden="true"
            />
            {a.labels.about} — {dict.studio.brand.role}
          </p>
          <h1
            id="about-heading"
            className="font-display text-[clamp(3.4rem,10vw,9.5rem)] leading-[0.88] tracking-[-0.035em]"
          >
            {a.hero.headlineA}
            <br />
            <span className="text-foreground/90 italic">
              {a.hero.headlineB}
            </span>
          </h1>
          <p className="text-foreground/70 mt-10 max-w-[52ch] text-[17px] leading-[1.65] sm:text-[19px]">
            {a.hero.intro}
          </p>
        </div>

        <div className="lg:col-span-5">
          <MonogramPanel
            caption={dict.studio.brand.name}
            className="aspect-[4/5] w-full rounded-[28px] border sm:max-w-[460px] lg:ms-auto"
          />
        </div>
      </div>

      <dl className="border-line mx-auto mt-16 grid max-w-[1440px] grid-cols-2 border-t lg:grid-cols-4">
        {FACT_ORDER.map((k, i) => (
          <div
            key={k}
            className={`border-line border-b py-6 pe-4 lg:border-b-0 ${i % 2 === 0 ? "" : "ps-4 lg:ps-6"} ${i > 0 ? "lg:border-s lg:ps-6" : ""}`}
          >
            <dt className="text-muted-foreground font-mono text-[10.5px] tracking-[0.2em] uppercase">
              {a.hero.facts[k].label}
            </dt>
            <dd className="text-foreground mt-2 text-[15px] sm:text-[16px]">
              {a.hero.facts[k].value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
