import Link from "next/link";
import type { ReactNode } from "react";

import { SectionHeading } from "./section-heading";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  SERVICE_GROUPS,
  serviceNumber,
  servicesIn,
} from "@/lib/content/services";
import { localePath, type Locale } from "@/lib/i18n";

/** The nine services as four outcome pillars, each linking to its Services section. */
export function ServicePillars({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}): ReactNode {
  const p = dict.home.pillars;
  const svc = dict.studio.services;

  return (
    <section
      aria-labelledby="home-services"
      className="px-5 pt-24 sm:px-10 sm:pt-36"
    >
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          index="02"
          eyebrow={p.eyebrow}
          title={p.title}
          accent={p.titleAccent}
          id="home-services"
        >
          <p className="text-muted-foreground max-w-[40ch] text-[15px] leading-[1.6]">
            {p.body}
          </p>
        </SectionHeading>

        <ul className="border-line mt-16 grid border-t sm:grid-cols-2 lg:grid-cols-4">
          {SERVICE_GROUPS.map((g, gi) => {
            const group = svc.groups[g];
            return (
              <li
                key={g}
                className="border-line border-b sm:odd:border-e lg:border-e lg:last:border-e-0"
              >
                <Link
                  href={`${localePath(locale, "/services")}#${g}`}
                  className="group hover:bg-surface flex h-full flex-col gap-8 p-6 transition-colors sm:p-8"
                >
                  <div className="text-muted-foreground flex items-center justify-between font-mono text-[11px] tracking-[0.2em] uppercase">
                    <span>0{gi + 1}</span>
                    <span className="group-hover:text-ember flex items-center gap-2 transition-colors">
                      {p.explore}
                      <span
                        aria-hidden="true"
                        className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
                      >
                        →
                      </span>
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display group-hover:text-ember text-[44px] leading-none italic transition-colors">
                      {group.title}
                    </h3>
                    <p className="text-foreground/65 mt-3 text-[15px] leading-[1.5]">
                      {group.outcome}
                    </p>
                  </div>
                  <ul className="border-line mt-auto flex flex-col gap-2.5 border-t pt-6">
                    {servicesIn(g).map((id) => (
                      <li
                        key={id}
                        className="flex items-baseline gap-3 text-[15px]"
                      >
                        <span
                          className="text-muted-foreground font-mono text-[10.5px]"
                          dir="ltr"
                        >
                          {serviceNumber(id)}
                        </span>
                        <span className="font-heading">
                          {svc.items[id].title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
