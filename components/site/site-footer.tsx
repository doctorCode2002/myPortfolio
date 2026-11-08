import type { ReactNode } from "react";

import { CopyEmail } from "./copy-email";
import { MotionToggle } from "./motion-toggle";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  EMAIL,
  SOCIALS,
  WHATSAPP_NUMBER,
  whatsappHref,
} from "@/lib/content/contact";

type Studio = Dictionary["studio"];

/**
 * The contact close and footer, on every page. Social links open in a new tab
 * (and say so to screen readers); WhatsApp appears once a number is configured.
 */
export function SiteFooter({ studio }: { studio: Studio }): ReactNode {
  const c = studio.contact;
  const year = new Date().getFullYear();

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="border-line relative overflow-hidden border-t px-5 pt-24 sm:px-10 sm:pt-32"
    >
      <div
        className="pointer-events-none absolute -bottom-1/2 left-1/2 h-[90%] w-[120%] -translate-x-1/2 rounded-[100%] opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--ember), transparent)",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-[1440px]">
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
          {c.eyebrow}
        </p>
        <h2
          id="contact-heading"
          className="font-display mt-6 text-[clamp(3.2rem,10vw,10rem)] leading-[0.88] tracking-[-0.035em]"
        >
          {c.headlineA}
          <br />
          {c.headlineB}{" "}
          <span className="text-ember italic">{c.headlineAccent}</span>
          <br />
          {c.headlineC}
        </h2>
        <p className="text-foreground/65 mt-8 max-w-[52ch] text-[16px] leading-[1.6] sm:text-[17px]">
          {c.body}
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <a
            href={`mailto:${EMAIL}`}
            className="hover:bg-ember bg-foreground text-background inline-flex items-center gap-3 rounded-full px-7 py-4 text-[15px] font-medium transition-colors"
          >
            {c.email}{" "}
            <span aria-hidden="true" className="rtl:-scale-x-100">
              →
            </span>
          </a>
          {WHATSAPP_NUMBER ? (
            <a
              href={whatsappHref(WHATSAPP_NUMBER)}
              target="_blank"
              rel="noopener noreferrer"
              className="border-line hover:border-foreground inline-flex items-center gap-3 rounded-full border px-7 py-4 text-[15px] transition-colors"
            >
              {c.whatsapp}
              <span className="sr-only"> ({c.opensInNewTab})</span>
            </a>
          ) : null}
          <CopyEmail
            email={EMAIL}
            labels={{ copy: c.copy, copied: c.copied }}
          />
        </div>

        <footer className="border-line text-muted-foreground mt-28 grid gap-8 border-t pt-8 pb-12 font-mono text-[11px] tracking-[0.18em] uppercase md:grid-cols-[1fr_auto_1fr] md:items-center">
          <span>
            © {year} {studio.brand.name} · {studio.footer.rights}
          </span>
          <nav
            aria-label={studio.footer.social}
            className="flex flex-wrap gap-6"
          >
            {SOCIALS.map((s) => (
              <a
                key={s.id}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {s.label}
                <span className="sr-only"> ({c.opensInNewTab})</span>
              </a>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-6 md:justify-end">
            <span>{studio.brand.location}</span>
            <MotionToggle labels={studio.motion} />
          </div>
        </footer>
      </div>
    </section>
  );
}
