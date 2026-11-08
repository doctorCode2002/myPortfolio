import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { SKILL_IDS } from "@/lib/content/about";

export function Skills({ dict }: { dict: Dictionary }): ReactNode {
  return (
    <div>
      <h3 className="font-display text-[40px] leading-none italic">
        {dict.aboutPage.skillsHeading}
      </h3>
      <ul className="mt-8 flex flex-wrap gap-2">
        {SKILL_IDS.map((id) => (
          <li
            key={id}
            className="border-line text-foreground/70 rounded-full border px-3.5 py-1.5 font-mono text-[11px] tracking-[0.12em] uppercase"
          >
            {dict.aboutPage.skills[id]}
          </li>
        ))}
      </ul>
    </div>
  );
}
