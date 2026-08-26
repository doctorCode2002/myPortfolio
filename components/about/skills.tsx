import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { SKILL_IDS } from "@/lib/content/about";

export function Skills({ dict }: { dict: Dictionary }): ReactNode {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-foreground">
        {dict.aboutPage.skillsHeading}
      </h2>
      <div className="rounded-4xl border border-foreground/10 bg-muted/50 p-2 sm:p-4">
        <ul className="flex flex-wrap gap-3">
          {SKILL_IDS.map((id) => (
            <li
              key={id}
              className="rounded-full border border-foreground/10 bg-background px-4 py-2 text-[14px] text-foreground/80 sm:text-[15px]"
            >
              {dict.aboutPage.skills[id]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
