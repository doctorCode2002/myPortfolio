import Link from "next/link";
import type { ReactNode } from "react";

import { SectionLabel } from "./section-label";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { SERVICE_GROUPS, servicesIn } from "@/lib/content/services";
import { localePath, type Locale } from "@/lib/i18n";

/** The four outcome pillars, each linking to its section on /services. */
export function Disciplines({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const a = dict.aboutStudio;
  const s = dict.studio.services;
  return (
    <section
      aria-labelledby="disciplines-heading"
      className="px-5 pt-28 sm:px-10 sm:pt-40"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel index={2}>{a.labels.disciplines}</SectionLabel>
          </div>
          <h2
            id="disciplines-heading"
            className="font-display text-[clamp(2.6rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.03em] lg:col-span-9"
          >
            {a.disciplines.title}{" "}
            <span className="text-foreground/55 italic">
              {a.disciplines.titleAccent}
            </span>
          </h2>
        </div>

        <ul className="border-line mt-16 grid border-t sm:grid-cols-2 lg:grid-cols-4">
          {SERVICE_GROUPS.map((g, i) => (
            <li
              key={g}
              className={`border-line border-b py-8 sm:pe-6 lg:border-b-0 ${i > 0 ? "lg:border-s lg:ps-6" : ""} ${i % 2 === 1 ? "sm:border-s sm:ps-6 lg:ps-6" : ""}`}
            >
              <Link
                href={`${localePath(locale, "/services")}#${g}`}
                className="group block"
              >
                <span className="text-muted-foreground font-mono text-[11px] tracking-[0.2em]">
                  0{i + 1}
                </span>
                <h3 className="font-display group-hover:text-ember mt-3 text-[40px] leading-none italic transition-colors">
                  {s.groups[g].title}
                </h3>
                <p className="text-foreground/65 mt-3 text-[15px] leading-[1.55]">
                  {s.groups[g].outcome}
                </p>
                <p className="text-muted-foreground mt-5 font-mono text-[10.5px] tracking-[0.14em] uppercase">
                  {servicesIn(g)
                    .map((id) => s.items[id].title)
                    .join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href={localePath(locale, "/services")}
          className="text-foreground/75 decoration-foreground/25 hover:text-foreground hover:decoration-foreground mt-10 inline-flex items-center gap-3 text-[15px] underline underline-offset-[6px] transition-colors"
        >
          {a.disciplines.cta}{" "}
          <span aria-hidden="true" className="rtl:-scale-x-100">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
