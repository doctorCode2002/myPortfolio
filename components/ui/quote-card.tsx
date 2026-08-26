import { Star } from "lucide-react";
import type { ReactNode } from "react";

import { interpolate } from "@/app/[lang]/dictionaries";

export function QuoteCard({
  quote,
  name,
  role,
  company,
  rating,
  ratingLabel,
  className = "",
}: {
  quote: string;
  name: string;
  role: string;
  company?: string;
  rating: number;
  /** Template containing `{rating}` — the visual stars are decorative. */
  ratingLabel: string;
  className?: string;
}): ReactNode {
  return (
    <figure
      className={`flex h-full flex-col gap-5 rounded-3xl border border-foreground/10 bg-background p-6 sm:p-7 ${className}`}
    >
      <div className="flex items-center gap-1">
        <span className="sr-only">
          {interpolate(ratingLabel, { rating })}
        </span>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            aria-hidden="true"
            className={
              i < rating
                ? "h-3.5 w-3.5 fill-accent text-accent"
                : "h-3.5 w-3.5 text-foreground/15"
            }
          />
        ))}
      </div>

      <blockquote className="flex-1 text-[15px] leading-[1.7] text-foreground/80 sm:text-[16px]">
        {quote}
      </blockquote>

      <figcaption className="flex flex-col gap-0.5 border-t border-foreground/10 pt-4">
        <span className="text-[15px] font-medium text-foreground">{name}</span>
        <span className="text-[13px] text-muted-foreground">
          {company !== undefined && company !== "" ? `${role} · ${company}` : role}
        </span>
      </figcaption>
    </figure>
  );
}
