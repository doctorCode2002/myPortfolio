import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { EDUCATION, type EducationEntry } from "@/lib/content/about";

const ROW_HEIGHT = 64;

export function Education({ dict }: { dict: Dictionary }): ReactNode {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-foreground">
        {dict.aboutPage.educationHeading}
      </h2>
      <div className="rounded-4xl border border-foreground/10 bg-muted/50 p-2 sm:p-4">
        <ul className="flex flex-col gap-2">
          {EDUCATION.map((entry) => (
            <EducationRow key={entry.id} entry={entry} dict={dict} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function EducationRow({
  entry,
  dict,
}: {
  entry: EducationEntry;
  dict: Dictionary;
}): ReactNode {
  const copy = dict.aboutPage.education[entry.id];

  return (
    <li
      className="flex items-center gap-4 rounded-3xl border border-foreground/10 bg-background p-2"
      style={{ minHeight: ROW_HEIGHT }}
    >
      <span
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center border border-foreground/15 text-[18px] font-semibold text-muted-foreground"
        aria-hidden="true"
        style={{ borderRadius: 14 }}
      >
        {copy.school.charAt(0)}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[17px] font-semibold text-foreground sm:text-[18px]">
          {copy.school}
        </span>
        <span className="mt-0.5 text-[14px] text-muted-foreground sm:text-[15px]">
          {copy.qualification}
          <span className="mx-2 text-foreground/25" aria-hidden="true">
            •
          </span>
          <span>{copy.period}</span>
        </span>
      </div>
    </li>
  );
}
