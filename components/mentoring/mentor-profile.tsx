import type { ReactNode } from "react";

import { FadeIn } from "@/components/ui/motion-primitives";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { MENTOR_POINT_IDS, MENTOR_STATS } from "@/lib/content/people";

export function MentorProfile({ dict }: { dict: Dictionary }): ReactNode {
  return (
    <section className="relative w-full">
      <div className="mx-auto w-full max-w-275 px-6 pt-44 pb-16 sm:px-10 sm:pt-56 sm:pb-24">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
          <FadeIn className="flex flex-col gap-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
              {dict.mentoring.eyebrow}
            </p>

            <h1 className="font-serif text-[2.5rem] font-medium leading-[1.05] text-foreground sm:text-[3rem] lg:text-[3.5rem]">
              {dict.mentoring.headline}
            </h1>

            <p className="max-w-[46ch] text-[17px] leading-[1.7] text-muted-foreground sm:text-[18px]">
              {dict.mentoring.body}
            </p>
          </FadeIn>

          <FadeIn delay={0.1} className="flex flex-col gap-10">
            <dl className="grid grid-cols-1 border-y border-foreground/10 sm:grid-cols-3">
              {MENTOR_STATS.map((stat) => (
                <div
                  key={stat.id}
                  className="border-b border-foreground/10 py-5 last:border-b-0 sm:border-b-0 sm:border-e sm:px-5 sm:last:border-e-0"
                >
                  <dt className="sr-only">{dict.mentoring.stats[stat.id]}</dt>
                  <dd>
                    {/* dir="ltr" has to sit on an *inline* span: on the block it
                        would also left-align the value, breaking the RTL column. */}
                    <span className="block font-serif text-[2.25rem] leading-none text-accent sm:text-[2.75rem]">
                      <span dir="ltr" className="inline-block">
                        {stat.value}
                      </span>
                    </span>
                    <span className="mt-3 block text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {dict.mentoring.stats[stat.id]}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            <ol className="grid gap-4">
              {MENTOR_POINT_IDS.map((id, index) => (
                <li
                  key={id}
                  className="grid grid-cols-[48px_1fr] gap-4 border-b border-foreground/10 pb-4"
                >
                  <span className="font-serif text-2xl leading-none text-accent/60">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[15px] leading-[1.7] text-foreground/80 sm:text-[16px]">
                    {dict.mentoring.points[id]}
                  </p>
                </li>
              ))}
            </ol>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
