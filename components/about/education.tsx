import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { EDUCATION } from "@/lib/content/about";

/** Degrees first, then certificates — same index layout as Experience. */
export function Education({ dict }: { dict: Dictionary }): ReactNode {
  const b = dict.aboutPage;
  return (
    <div>
      <h3 className="font-display text-[40px] leading-none italic">
        {b.educationHeading}
      </h3>
      <ul className="border-line mt-8 border-t">
        {EDUCATION.map((e) => {
          const c = b.education[e.id];
          return (
            <li
              key={e.id}
              className="border-line grid gap-1 border-b py-5 sm:grid-cols-[10rem_1fr] sm:gap-6"
            >
              <span className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase sm:pt-1.5">
                {c.period}
              </span>
              <div>
                <p className="font-heading text-[20px] font-medium tracking-[-0.01em]">
                  {c.qualification}
                </p>
                <p className="text-foreground/60 mt-1 text-[15px]">
                  {c.school}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
