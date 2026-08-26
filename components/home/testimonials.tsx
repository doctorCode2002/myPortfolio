import type { ReactNode } from "react";

import { FadeIn } from "@/components/ui/motion-primitives";
import { QuoteCard } from "@/components/ui/quote-card";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { TESTIMONIALS } from "@/lib/content/people";

export function Testimonials({ dict }: { dict: Dictionary }): ReactNode {
  // Rendered twice so the -50% keyframe loops seamlessly. The duplicate is
  // hidden from assistive tech so quotes aren't announced twice.
  const track = [false, true] as const;

  return (
    <section className="relative w-full overflow-hidden py-16 sm:py-24">
      <FadeIn className="mx-auto flex w-full max-w-275 flex-col items-center gap-4 px-6 pb-10 text-center sm:px-10 sm:pb-14">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
          {dict.testimonials.eyebrow}
        </p>
        <h2 className="font-serif text-[2rem] font-medium leading-[1.1] text-foreground sm:text-[2.5rem]">
          {dict.testimonials.headline}
        </h2>
      </FadeIn>

      <div className="relative">
        <div className="marquee gap-6">
          {track.map((isClone) => (
            <ul
              key={isClone ? "clone" : "original"}
              aria-hidden={isClone ? "true" : undefined}
              className="flex shrink-0 gap-6 pe-6"
            >
              {TESTIMONIALS.map((testimonial) => {
                const copy = dict.testimonials.items[testimonial.id];
                return (
                  <li key={testimonial.id} className="w-[320px] shrink-0 sm:w-[380px]">
                    <QuoteCard
                      quote={copy.quote}
                      name={copy.name}
                      role={copy.role}
                      company={copy.company}
                      rating={testimonial.rating}
                      ratingLabel={dict.testimonials.ratingLabel}
                    />
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
