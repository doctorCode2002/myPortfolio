import type { ReactNode } from "react";

import { SectionLabel } from "./section-label";
import type { Dictionary } from "@/app/[lang]/dictionaries";

const ORDER = ["contact", "craft", "evidence"] as const;

/** Why a one-person studio: the "no hand-offs" argument in three lines. */
export function Approach({ dict }: { dict: Dictionary }): ReactNode {
  const a = dict.aboutStudio;
  return (
    <section
      aria-labelledby="approach-heading"
      className="px-5 pt-28 sm:px-10 sm:pt-40"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel index={4}>{a.labels.approach}</SectionLabel>
          </div>
          <h2
            id="approach-heading"
            className="font-display text-[clamp(2.6rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.03em] lg:col-span-9"
          >
            {a.approach.title}{" "}
            <span className="text-ember italic">{a.approach.titleAccent}</span>?
          </h2>
        </div>
        <ol className="border-line bg-line mt-16 grid gap-px overflow-hidden rounded-[28px] border md:grid-cols-3">
          {ORDER.map((k, i) => (
            <li key={k} className="bg-surface flex flex-col gap-10 p-7 sm:p-9">
              <span className="font-display text-ember text-[56px] leading-none">
                <span dir="ltr" className="inline-block">
                  0{i + 1}
                </span>
              </span>
              <div>
                <h3 className="font-heading text-[22px] leading-tight font-medium tracking-[-0.01em]">
                  {a.approach.items[k].title}
                </h3>
                <p className="text-foreground/65 mt-3 text-[15px] leading-[1.6]">
                  {a.approach.items[k].body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
