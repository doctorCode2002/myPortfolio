import type { ReactNode } from "react";

import { SectionLabel } from "./section-label";
import { interpolate, type Dictionary } from "@/app/[lang]/dictionaries";
import { TESTIMONIALS } from "@/lib/content/people";

/** Client testimonials: one large lead quote, the rest as a hairline list. */
export function AboutTestimonials({
  dict,
  index,
}: {
  dict: Dictionary;
  index: number;
}): ReactNode {
  const t = dict.testimonials;
  const [lead, ...rest] = TESTIMONIALS;
  if (!lead) return null;
  const leadCopy = t.items[lead.id];
  return (
    <section
      aria-labelledby="words-heading"
      className="px-5 pt-28 sm:px-10 sm:pt-40"
    >
      <div className="mx-auto max-w-[1440px]">
        <SectionLabel index={index} id="words-heading">
          {dict.aboutStudio.labels.words}
        </SectionLabel>
        <figure className="mt-10 max-w-[1100px]">
          <span
            className="font-display text-ember block text-[110px] leading-[0.6]"
            aria-hidden="true"
          >
            &ldquo;
          </span>
          <blockquote className="font-display mt-4 text-[clamp(2rem,4.4vw,4rem)] leading-[1.08] tracking-[-0.02em]">
            {leadCopy.quote}
          </blockquote>
          <figcaption className="text-muted-foreground mt-8 flex items-center gap-4 font-mono text-[11px] tracking-[0.2em] uppercase">
            <span className="bg-foreground/30 h-px w-10" aria-hidden="true" />
            {leadCopy.name} · {leadCopy.role}, {leadCopy.company}
          </figcaption>
        </figure>

        <ul className="border-line bg-line mt-20 grid gap-px overflow-hidden rounded-[28px] border md:grid-cols-2">
          {rest.map((r) => {
            const c = t.items[r.id];
            return (
              <li
                key={r.id}
                className="bg-background flex flex-col justify-between gap-8 p-7 sm:p-9"
              >
                <blockquote className="text-foreground/80 text-[16px] leading-[1.65]">
                  &ldquo;{c.quote}&rdquo;
                </blockquote>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-heading text-[17px] font-medium">
                      {c.name}
                    </p>
                    <p className="text-muted-foreground mt-1 font-mono text-[10.5px] tracking-[0.16em] uppercase">
                      {c.role} · {c.company}
                    </p>
                  </div>
                  <p
                    className="text-ember shrink-0 text-[13px] tracking-[0.2em]"
                    aria-label={interpolate(t.ratingLabel, {
                      rating: r.rating,
                    })}
                  >
                    <span aria-hidden="true">{"★".repeat(r.rating)}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
