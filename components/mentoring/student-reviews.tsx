import type { ReactNode } from "react";

import { FadeIn } from "@/components/ui/motion-primitives";
import { QuoteCard } from "@/components/ui/quote-card";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { STUDENT_REVIEWS } from "@/lib/content/people";

export function StudentReviews({ dict }: { dict: Dictionary }): ReactNode {
  return (
    <section className="relative w-full">
      <div className="mx-auto w-full max-w-275 px-6 py-16 sm:px-10 sm:py-20">
        <FadeIn className="flex flex-col items-center gap-4 pb-10 text-center sm:pb-14">
          <h2 className="font-serif text-[2rem] font-medium leading-[1.1] text-foreground sm:text-[2.5rem]">
            {dict.mentoring.reviewsHeadline}
          </h2>
          <p className="max-w-[42ch] text-[17px] leading-[1.5] text-muted-foreground sm:text-[18px]">
            {dict.mentoring.reviewsSub}
          </p>
        </FadeIn>

        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {STUDENT_REVIEWS.map((review, index) => {
            const copy = dict.mentoring.items[review.id];
            return (
              <li key={review.id}>
                <FadeIn delay={Math.min(index * 0.05, 0.3)} className="h-full">
                  <QuoteCard
                    quote={copy.quote}
                    name={copy.name}
                    role={copy.role}
                    rating={review.rating}
                    ratingLabel={dict.testimonials.ratingLabel}
                  />
                </FadeIn>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
