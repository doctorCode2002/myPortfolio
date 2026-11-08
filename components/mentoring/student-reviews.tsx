import type { ReactNode } from "react";

import { SectionLabel } from "@/components/about/section-label";
import { interpolate, type Dictionary } from "@/app/[lang]/dictionaries";
import { STUDENT_REVIEWS } from "@/lib/content/people";

/** Student feedback as a hairline grid of quotes. */
export function StudentReviews({ dict }: { dict: Dictionary }): ReactNode {
  const m = dict.mentoring;
  const a = dict.aboutStudio.mentoring;
  return (
    <section
      aria-labelledby="reviews-heading"
      className="px-5 pt-28 pb-28 sm:px-10 sm:pt-40 sm:pb-36"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel index={2}>{a.reviewsLabel}</SectionLabel>
          </div>
          <div className="lg:col-span-9">
            <h2
              id="reviews-heading"
              className="font-display text-[clamp(2.6rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.03em]"
            >
              {m.reviewsHeadline}
            </h2>
            <p className="text-foreground/60 mt-5 max-w-[46ch] text-[16px] leading-[1.6]">
              {m.reviewsSub}
            </p>
          </div>
        </div>

        <ul className="border-line bg-line mt-16 grid gap-px overflow-hidden rounded-[28px] border md:grid-cols-2 lg:grid-cols-3">
          {STUDENT_REVIEWS.map((r, i) => {
            const c = m.items[r.id];
            return (
              <li
                key={r.id}
                className={`bg-background flex flex-col justify-between gap-8 p-7 sm:p-8 ${
                  i === STUDENT_REVIEWS.length - 1
                    ? "md:col-span-2 lg:col-span-3"
                    : ""
                }`}
              >
                <blockquote className="text-foreground/80 text-[15.5px] leading-[1.65]">
                  &ldquo;{c.quote}&rdquo;
                </blockquote>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-heading text-[17px] font-medium">
                      {c.name}
                    </p>
                    <p className="text-muted-foreground mt-1 font-mono text-[10.5px] tracking-[0.16em] uppercase">
                      {c.role}
                    </p>
                  </div>
                  <p
                    className="text-ember shrink-0 text-[13px] tracking-[0.2em]"
                    aria-label={interpolate(dict.testimonials.ratingLabel, {
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

        <a
          href="#contact"
          className="border-line hover:border-foreground mt-12 inline-flex items-center gap-3 rounded-full border px-6 py-3.5 text-[14px] transition-colors"
        >
          {a.cta}{" "}
          <span aria-hidden="true" className="rtl:-scale-x-100">
            →
          </span>
        </a>
      </div>
    </section>
  );
}
