import Link from "next/link";
import type { ReactNode } from "react";

import { HeroGradient } from "./hero-gradient";
import { HeroHeadline } from "./hero-headline";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import Magnet from "@/components/vendor/reactbits/Magnet";
import { localePath, type Locale } from "@/lib/i18n";

export function HomeHero({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}): ReactNode {
  const h = dict.home.hero;
  const s = dict.studio;

  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
      <HeroGradient />

      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-end px-5 pt-32 pb-14 sm:px-10 sm:pb-16">
        <p className="text-muted-foreground mb-8 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] uppercase">
          <span
            className="bg-ember inline-block size-1.5 rounded-full"
            aria-hidden="true"
          />
          {s.brand.name} — {h.eyebrow}
        </p>

        <HeroHeadline lineA={h.headlineA} lineB={h.headlineB} />

        <div className="border-line mt-14 grid gap-10 border-t pt-8 md:grid-cols-12 md:gap-6">
          <p className="text-foreground/65 max-w-[46ch] text-[16px] leading-[1.6] md:col-span-5 md:text-[17px]">
            {h.intro}
          </p>
          <div className="flex flex-wrap items-center gap-5 md:col-span-4 md:justify-center">
            <Magnet padding={70} magnetStrength={4} maxOffset={14}>
              <a
                href="#contact"
                className="group bg-ember text-ember-foreground inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-[14px] font-medium"
              >
                {h.ctaPrimary}
                <span
                  className="transition-transform duration-300 group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
              </a>
            </Magnet>
            <Link
              href={localePath(locale, "/projects")}
              className="text-foreground/70 decoration-foreground/25 hover:text-foreground hover:decoration-foreground text-[14px] underline underline-offset-[6px] transition-colors"
            >
              {h.ctaSecondary}
            </Link>
          </div>
          <div className="text-muted-foreground flex flex-wrap justify-between gap-x-6 gap-y-2 font-mono text-[11px] leading-[1.8] tracking-[0.18em] uppercase md:col-span-3 md:block md:text-end">
            <p>{s.brand.location}</p>
            <p className="flex items-center gap-2 md:justify-end">
              <span className="relative flex size-1.5" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              {s.brand.availability}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
