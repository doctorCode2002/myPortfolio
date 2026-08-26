import { Github, Instagram, Linkedin, Mail } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import { ActionRow } from "@/components/ui/action-row";
import { FadeIn } from "@/components/ui/motion-primitives";
import { ShaderFlow } from "@/components/shaders/shader-flow";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { EMAIL, SOCIALS, type SocialId } from "@/lib/content/contact";
import { localePath, type Locale } from "@/lib/i18n";

const CARD_FADE_MASK =
  "radial-gradient(ellipse 90% 110% at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.4) 90%, rgba(0,0,0,0.15) 100%)";

const SOCIAL_ICONS: Record<
  SocialId,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  linkedin: Linkedin,
  github: Github,
  instagram: Instagram,
};

/** Baked at build time, exactly as the previous site did it. */
const CURRENT_YEAR = new Date().getFullYear();

export function ContactCard({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}): ReactNode {
  return (
    <section className="mx-auto my-12 w-full max-w-275 px-6 sm:my-20 sm:px-10">
      <FadeIn>
        <div className="relative w-full overflow-hidden rounded-4xl border border-foreground/10 bg-background p-1.5 shadow-sm">
          <div className="relative w-full overflow-hidden rounded-[1.6rem]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-45 dark:opacity-25"
              style={{
                WebkitMaskImage: CARD_FADE_MASK,
                maskImage: CARD_FADE_MASK,
              }}
            >
              <ShaderFlow scale={3} brightness={1.5} />
            </div>

            <div className="relative grid gap-8 p-6 sm:gap-10 sm:p-7 md:grid-cols-[1.2fr_1fr] md:items-stretch md:gap-6 md:p-6">
              <div className="flex flex-col gap-5">
                <h2 className="font-serif text-[2.25rem] font-medium leading-[1.05] text-foreground sm:text-[2.75rem] lg:text-[3.25rem]">
                  {dict.contact.headline}
                </h2>
                <p className="mb-6 max-w-[32ch] text-[18px] leading-[1.45] text-muted-foreground sm:text-[22px]">
                  {dict.contact.body}
                </p>
                <ActionRow
                  contactLabels={dict.contact}
                  secondary={[
                    {
                      href: localePath(locale, "/projects"),
                      label: dict.projects.viewAll,
                      icon: "arrow",
                    },
                  ]}
                />
              </div>

              <div className="flex flex-col items-center justify-center gap-6 rounded-[1.1rem] border border-foreground/10 bg-background p-6 sm:p-8">
                <ul className="flex items-center gap-3">
                  <li>
                    <SocialIcon
                      href={`mailto:${EMAIL}`}
                      label="Email"
                      icon={Mail}
                    />
                  </li>
                  {SOCIALS.map((social) => (
                    <li key={social.id}>
                      <SocialIcon
                        href={social.href}
                        label={social.label}
                        icon={SOCIAL_ICONS[social.id]}
                      />
                    </li>
                  ))}
                </ul>
                <p className="flex flex-col items-center gap-1 text-center">
                  <span className="text-[13px] text-muted-foreground">
                    <span dir="ltr">{CURRENT_YEAR}</span> © {dict.meta.siteName}{" "}
                    — {dict.contact.rights}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {dict.contact.builtWith}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

function SocialIcon({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}): ReactNode {
  const isExternal = href.startsWith("http");

  return (
    <Link
      href={href}
      aria-label={label}
      {...(isExternal
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl border border-foreground/10 bg-background text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
