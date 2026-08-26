import Image from "next/image";
import type { ReactNode } from "react";

import { FadeIn } from "@/components/ui/motion-primitives";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { SERVICE_IDS } from "@/lib/content/contact";

export function Services({ dict }: { dict: Dictionary }): ReactNode {
  return (
    <section className="relative w-full">
      <div className="mx-auto w-full max-w-275 px-6 py-16 sm:px-10 sm:py-24">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
          <FadeIn>
            <div className="relative aspect-square w-full overflow-hidden rounded-4xl border border-foreground/10 bg-muted">
              <Image
                src="/assets/servicesImg.webp"
                alt={dict.services.imageAlt}
                fill
                sizes="(min-width: 768px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.1} className="flex flex-col gap-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
              {dict.services.eyebrow}
            </p>

            <h2 className="font-serif text-[2rem] font-medium leading-[1.1] text-foreground sm:text-[2.5rem] lg:text-[3rem]">
              {dict.services.headline}
            </h2>

            <p className="max-w-[42ch] text-[17px] leading-[1.6] text-muted-foreground sm:text-[18px]">
              {dict.services.body}
            </p>

            <ul className="mt-2 flex flex-col">
              {SERVICE_IDS.map((id) => {
                const service = dict.services.items[id];
                return (
                  <li
                    key={id}
                    className="border-t border-foreground/10 py-5 last:border-b"
                  >
                    <h3 className="text-[17px] font-medium text-foreground">
                      {service.title}
                    </h3>
                    <p className="mt-1.5 text-[15px] leading-[1.6] text-muted-foreground">
                      {service.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
