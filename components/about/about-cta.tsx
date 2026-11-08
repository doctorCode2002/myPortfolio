import Link from "next/link";
import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { CV_PATH } from "@/lib/content/contact";
import { localePath, type Locale } from "@/lib/i18n";

/** Closing actions: CV, services, and the global contact section. */
export function AboutCta({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const c = dict.aboutStudio.cta;
  return (
    <div className="mx-auto mt-24 flex max-w-[1440px] flex-wrap items-center gap-4 px-5 pb-28 sm:mt-32 sm:px-10 sm:pb-36">
      <a
        href="#contact"
        className="hover:bg-ember bg-foreground text-background inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-[14px] font-medium transition-colors"
      >
        {c.contact}{" "}
        <span aria-hidden="true" className="rtl:-scale-x-100">
          →
        </span>
      </a>
      <Link
        href={localePath(locale, "/services")}
        className="border-line hover:border-foreground inline-flex items-center gap-3 rounded-full border px-6 py-3.5 text-[14px] transition-colors"
      >
        {c.services}
      </Link>
      <a
        href={CV_PATH}
        download
        className="text-foreground/70 decoration-foreground/25 hover:text-foreground inline-flex items-center gap-2 px-2 py-3.5 text-[14px] underline underline-offset-[6px] transition-colors"
      >
        {c.cv} <span aria-hidden="true">↓</span>
      </a>
    </div>
  );
}
