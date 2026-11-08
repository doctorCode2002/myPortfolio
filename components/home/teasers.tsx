import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";

function Arrow(): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
    >
      →
    </span>
  );
}

/** About + Mentoring, side by side: who you'd be working with, and what else they do. */
export function HomeTeasers({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}): ReactNode {
  const a = dict.home.about;
  const m = dict.home.mentoring;

  return (
    <section
      aria-label={`${a.eyebrow} · ${m.eyebrow}`}
      className="px-5 pt-24 pb-24 sm:px-10 sm:pt-36 sm:pb-36"
    >
      <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-12">
        <article className="border-line bg-surface grid overflow-hidden rounded-[28px] border sm:grid-cols-5 lg:col-span-8">
          <div className="relative aspect-[4/5] overflow-hidden sm:col-span-2 sm:aspect-auto">
            <Image
              src="/assets/scenes/hero.webp"
              alt={a.portraitAlt}
              fill
              sizes="(min-width: 1024px) 26vw, (min-width: 640px) 40vw, 100vw"
              className="object-cover object-[71%_40%]"
            />
          </div>
          <div className="flex flex-col justify-between gap-10 p-7 sm:col-span-3 sm:p-10">
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
              (05) {a.eyebrow}
            </p>
            <div>
              <h2 className="font-display text-[clamp(2.4rem,4.5vw,4rem)] leading-[0.95] tracking-[-0.02em]">
                {a.title}{" "}
                <span className="text-ember italic">{a.titleAccent}</span>
              </h2>
              <p className="text-foreground/65 mt-5 max-w-[46ch] text-[16px] leading-[1.6]">
                {a.body}
              </p>
            </div>
            <Link
              href={localePath(locale, "/about")}
              className="group border-line hover:border-foreground hover:bg-foreground hover:text-background inline-flex w-fit items-center gap-3 rounded-full border px-6 py-3 text-[14px] transition-colors"
            >
              {a.cta} <Arrow />
            </Link>
          </div>
        </article>

        <article className="border-line flex flex-col justify-between gap-10 rounded-[28px] border p-7 sm:p-10 lg:col-span-4">
          <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
            (06) {m.eyebrow}
          </p>
          <div>
            <h2 className="font-display text-[clamp(2.2rem,3.6vw,3.25rem)] leading-[0.98] tracking-[-0.02em] italic">
              {m.title}
            </h2>
            <p className="text-foreground/65 mt-5 text-[15px] leading-[1.6]">
              {m.body}
            </p>
          </div>
          <Link
            href={localePath(locale, "/mentoring")}
            className="group hover:text-ember inline-flex w-fit items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase transition-colors"
          >
            {m.cta} <Arrow />
          </Link>
        </article>
      </div>
    </section>
  );
}
