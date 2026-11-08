import type { ReactNode } from "react";

import { SectionHeading } from "./section-heading";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { TESTIMONIALS } from "@/lib/content/people";

/** One large lead quote, then the rest as a quiet grid — all attributed. */
export function HomeTestimonials({ dict }: { dict: Dictionary }): ReactNode {
  const t = dict.home.testimonials;
  const items = dict.testimonials.items;
  const [lead, ...rest] = TESTIMONIALS;
  if (!lead) return null;
  const l = items[lead.id];

  return (
    <section
      aria-labelledby="home-testimonials"
      className="px-5 pt-24 sm:px-10 sm:pt-36"
    >
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          index="04"
          eyebrow={t.eyebrow}
          title={t.title}
          id="home-testimonials"
        />

        <figure className="mt-14 max-w-[1100px]">
          <span
            className="font-display text-ember block text-[120px] leading-[0.6]"
            aria-hidden="true"
          >
            &ldquo;
          </span>
          <blockquote className="font-display mt-6 text-[clamp(1.9rem,4.4vw,4rem)] leading-[1.1] tracking-[-0.02em]">
            {l.quote}
          </blockquote>
          <figcaption className="text-muted-foreground mt-10 flex items-center gap-4 font-mono text-[11px] tracking-[0.2em] uppercase">
            <span className="bg-foreground/30 h-px w-10" aria-hidden="true" />
            {l.name} · {l.role}, {l.company}
          </figcaption>
        </figure>

        <ul className="border-line bg-line mt-20 grid gap-px overflow-hidden rounded-[24px] border sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((r) => {
            const q = items[r.id];
            return (
              <li
                key={r.id}
                className="bg-background flex flex-col justify-between gap-8 p-6 sm:p-7"
              >
                <blockquote className="text-foreground/75 text-[15px] leading-[1.6]">
                  &ldquo;{q.quote}&rdquo;
                </blockquote>
                <p className="text-muted-foreground font-mono text-[10.5px] leading-[1.7] tracking-[0.16em] uppercase">
                  <span className="text-foreground/80">{q.name}</span>
                  <br />
                  {q.role}, {q.company}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
