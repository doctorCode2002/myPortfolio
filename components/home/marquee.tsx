"use client";

import type { ReactNode } from "react";

import ScrollVelocity from "@/components/vendor/reactbits/ScrollVelocity";
import { useMotionAllowed } from "@/lib/motion";

const Star = (): ReactNode => (
  <span className="text-ember mx-8 not-italic sm:mx-10" aria-hidden="true">
    ✺
  </span>
);

/**
 * Service names in big serif type, drifting with scroll velocity. Decorative
 * (the services are listed properly below), so it is hidden from assistive
 * tech; with motion off it becomes a still, wrapped line.
 */
export function ServicesMarquee({
  items,
}: {
  items: readonly string[];
}): ReactNode {
  const allowed = useMotionAllowed();
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)];

  return (
    <div
      className="border-line border-y py-8 sm:py-10"
      aria-hidden="true"
      dir="ltr"
    >
      {allowed ? (
        <ScrollVelocity
          texts={rows.map((row, r) => (
            <span key={r}>
              {row.map((t, i) => (
                <span key={t}>
                  {i > 0 ? <Star /> : null}
                  {t}
                </span>
              ))}
            </span>
          ))}
          velocity={40}
          numCopies={4}
          fadeEdges
          gap={40}
          separator={<Star />}
          className="!font-display !font-normal italic"
          fontSize="clamp(2.4rem, 6vw, 5.5rem)"
          fontWeight={400}
          color="var(--foreground)"
          outlineAlternate
        />
      ) : (
        <p className="font-display mx-auto max-w-[1440px] px-5 text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.1] italic sm:px-10">
          {items.map((t, i) => (
            <span key={t}>
              {i > 0 ? <Star /> : null}
              {t}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
