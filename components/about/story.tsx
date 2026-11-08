import type { ReactNode } from "react";

import { PolaroidStrip } from "./polaroid-strip";
import { SectionLabel } from "./section-label";
import type { Dictionary } from "@/app/[lang]/dictionaries";

/** The bio, set as a two-column editorial spread. */
export function Story({ dict }: { dict: Dictionary }): ReactNode {
  const a = dict.aboutStudio;
  const b = dict.aboutPage;
  return (
    <section
      aria-labelledby="story-heading"
      className="px-5 pt-28 sm:px-10 sm:pt-40"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel index={3}>{a.labels.story}</SectionLabel>
          </div>
          <div className="lg:col-span-9">
            <h2
              id="story-heading"
              className="font-display text-[clamp(2.6rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.03em]"
            >
              {a.story.title}{" "}
              <span className="text-foreground/55 italic">
                {a.story.titleAccent}
              </span>
            </h2>
            <div className="text-foreground/70 mt-12 grid gap-x-12 gap-y-6 text-[16px] leading-[1.75] sm:text-[17px] md:grid-cols-2">
              <p className="text-foreground">{b.bio1}</p>
              <p>{b.bio2}</p>
              <p>{b.bio3}</p>
              <p>{b.bio4}</p>
            </div>
          </div>
        </div>
        <div className="mt-20">
          <PolaroidStrip dict={dict} />
        </div>
      </div>
    </section>
  );
}
