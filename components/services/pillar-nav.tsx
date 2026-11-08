"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { ServiceGroup } from "@/lib/content/services";

/**
 * Sticky in-page nav for the four pillars (desktop). Highlights the pillar
 * currently in view; plain anchor links, so it works without JavaScript.
 */
export function PillarNav({
  label,
  items,
}: {
  label: string;
  items: readonly { id: ServiceGroup; title: string; number: string }[];
}): ReactNode {
  const [active, setActive] = useState<ServiceGroup | null>(null);

  useEffect(() => {
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0];
        if (visible) setActive(visible.target.id as ServiceGroup);
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className="sticky top-24">
      <ol className="border-line flex flex-col gap-1 border-s">
        {items.map((i) => {
          const on = active === i.id;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                aria-current={on ? "true" : undefined}
                className={`-ms-px flex items-baseline gap-3 border-s py-2 ps-4 transition-colors ${
                  on
                    ? "border-ember text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                }`}
              >
                <span className="font-mono text-[10px] tracking-[0.2em]">
                  {i.number}
                </span>
                <span className="font-display text-[22px] leading-none">
                  {i.title}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
