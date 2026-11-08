import type { ReactNode } from "react";

import { SectionLabel } from "@/components/about/section-label";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { MENTOR_POINT_IDS, MENTOR_STATS } from "@/lib/content/people";

/** Mentoring hero: statement, three headline figures, and what the program covers. */
export function MentorProfile({ dict }: { dict: Dictionary }): ReactNode {
  const m = dict.mentoring;
  const a = dict.aboutStudio.mentoring;
  return (
    <section
      aria-labelledby="mentoring-heading"
      className="px-5 pt-32 sm:px-10 sm:pt-44"
    >
      <div className="mx-auto max-w-[1440px]">
        <p className="text-muted-foreground mb-8 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] uppercase">
          <span
            className="bg-ember inline-block size-1.5 rounded-full"
            aria-hidden="true"
          />
          {a.label} — {m.eyebrow}
        </p>
        <h1
          id="mentoring-heading"
          className="font-display max-w-[16ch] text-[clamp(3rem,8.5vw,8rem)] leading-[0.9] tracking-[-0.035em]"
        >
          {m.headline}
        </h1>
        <p className="text-foreground/70 mt-10 max-w-[56ch] text-[17px] leading-[1.65] sm:text-[19px]">
          {m.body}
        </p>

        <dl className="border-line mt-16 grid border-y sm:grid-cols-3">
          {MENTOR_STATS.map((stat, i) => (
            <div
              key={stat.id}
              className={`border-line border-b py-8 last:border-b-0 sm:border-b-0 ${i > 0 ? "sm:border-s sm:ps-8" : ""}`}
            >
              <dt className="text-muted-foreground font-mono text-[11px] tracking-[0.2em] uppercase">
                {m.stats[stat.id]}
              </dt>
              <dd className="font-display text-ember mt-3 text-[clamp(3rem,6vw,5rem)] leading-none">
                {/* dir="ltr" on an inline span keeps "1:1" readable without left-aligning the RTL column. */}
                <span dir="ltr" className="inline-block">
                  {stat.value}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-24 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel index={1}>{a.pointsLabel}</SectionLabel>
          </div>
          <ol className="border-line border-t lg:col-span-9">
            {MENTOR_POINT_IDS.map((id, i) => (
              <li
                key={id}
                className="border-line grid grid-cols-[3.5rem_1fr] gap-4 border-b py-6 sm:grid-cols-[5rem_1fr]"
              >
                <span className="font-display text-foreground/35 text-[34px] leading-none">
                  <span dir="ltr" className="inline-block">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <p className="text-foreground/80 text-[16px] leading-[1.65] sm:text-[17px]">
                  {m.points[id]}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
