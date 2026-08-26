import type { ReactNode } from "react";

import { PortraitMorph } from "./portrait-morph";
import { ActionRow } from "@/components/ui/action-row";
import { FadeIn, ScaleUnblur } from "@/components/ui/motion-primitives";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { CV_PATH } from "@/lib/content/contact";
import { localePath, type Locale } from "@/lib/i18n";

// TODO: replace portrait-alt.webp with a second pose — same framing and crop as
// portrait.webp (2752x1536), otherwise the hover morph has nothing to morph to.
// Until then both slots point at the same image and the hover is a no-op.
const PORTRAIT_SRC = "/portrait.webp";
const PORTRAIT_HOVER_SRC = "/portrait-alt.webp";

export function Hero({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}): ReactNode {
  return (
    <section className="relative w-full">
      <div className="mx-auto w-full max-w-275 px-6 pt-44 pb-24 sm:px-10 sm:pt-56 sm:pb-32">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-8">
          <FadeIn className="flex flex-col gap-4">
            <p className="text-[20px] font-medium leading-tight text-foreground">
              {dict.hero.greeting}
            </p>

            <h1 className="font-serif text-[2.75rem] font-medium leading-[1.05] text-foreground md:text-[2.5rem] lg:text-[3.65rem]">
              <span className="block">{dict.hero.headlineA}</span>
              <span className="block">{dict.hero.headlineB}</span>
            </h1>

            <p className="max-w-[36ch] text-[20px] leading-[1.45] text-muted-foreground sm:text-[22px]">
              {dict.hero.intro}
            </p>

            <ActionRow
              contactLabels={dict.contact}
              secondary={[
                {
                  href: localePath(locale, "/projects"),
                  label: dict.hero.viewWork,
                  icon: "arrow",
                },
                {
                  href: CV_PATH,
                  label: dict.hero.downloadCv,
                  icon: "download",
                  download: true,
                },
              ]}
            />
          </FadeIn>

          <ScaleUnblur className="flex justify-stretch md:justify-end">
            <div className="relative aspect-square w-full overflow-hidden rounded-4xl border border-foreground/10 bg-background p-1.5 shadow-sm md:max-w-105">
              <div className="relative h-full w-full overflow-hidden rounded-[1.6rem]">
                <PortraitMorph
                  srcA={PORTRAIT_SRC}
                  srcB={PORTRAIT_HOVER_SRC}
                  alt={dict.hero.portraitAlt}
                />
              </div>
            </div>
          </ScaleUnblur>
        </div>
      </div>
    </section>
  );
}
