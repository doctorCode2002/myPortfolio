"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { MotionToggle } from "./motion-toggle";
import { SITE_ROUTES, isActivePath } from "./site-nav";
import {
  SMOOTH_SCROLL_PAUSE,
  SMOOTH_SCROLL_RESUME,
} from "@/components/layout/smooth-scroll";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { EMAIL, SOCIALS } from "@/lib/content/contact";
import { localePath, type Locale } from "@/lib/i18n";

type Studio = Dictionary["studio"];

/**
 * Fixed header. Transparent over the top of the page, then a blurred bar; it
 * slides away while scrolling down and returns on any scroll up. Below `md`
 * the links move into a full-screen menu.
 */
export function SiteHeader({
  locale,
  studio,
}: {
  locale: Locale;
  studio: Studio;
}): ReactNode {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  // The menu remembers the page it was opened on, so navigating anywhere closes
  // it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean): void => setOpenedOn(next ? pathname : null);
  const lastY = useRef(0);
  const menuButton = useRef<HTMLButtonElement>(null);
  const t = studio.nav;

  // Hide while scrolling down, show while scrolling up. Decided by direction
  // with a dead zone, not by per-event deltas: smooth scrolling emits many
  // tiny steps as it eases, and reacting to each one made the bar flicker.
  // `anchor` is where the current scroll direction began; the bar only
  // changes state after travelling SLACK px from it in one direction.
  useEffect(() => {
    const SLACK = 12;
    const ALWAYS_SHOWN_ABOVE = 120;
    let anchor = window.scrollY;
    let goingDown = false;
    let raf = 0;

    const update = (): void => {
      raf = 0;
      const y = Math.max(0, window.scrollY);
      const last = lastY.current;
      lastY.current = y;
      setScrolled(y > 24);

      if (y <= ALWAYS_SHOWN_ABOVE) {
        setHidden(false);
        anchor = y;
        return;
      }
      if (y === last) return;

      const down = y > last;
      if (down !== goingDown) {
        goingDown = down;
        anchor = last;
      }
      if (down && y - anchor > SLACK) setHidden(true);
      else if (!down && anchor - y > SLACK) setHidden(false);
    };

    const onScroll = (): void => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    lastY.current = window.scrollY;
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    window.dispatchEvent(new Event(SMOOTH_SCROLL_PAUSE));
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpenedOn(null);
    };
    window.addEventListener("keydown", onKey);
    const button = menuButton.current;
    return () => {
      html.style.overflow = prev;
      window.dispatchEvent(new Event(SMOOTH_SCROLL_RESUME));
      window.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [open]);

  const home = localePath(locale, "/");
  const contactHref = `${pathname}#contact`;

  return (
    <>
      <header
        onFocusCapture={() => setHidden(false)}
        style={{ viewTransitionName: "site-header" }}
        className={`fixed inset-x-0 top-0 z-[90] transition-[transform,background-color,border-color] duration-500 ease-[cubic-bezier(.2,.7,.1,1)] ${
          hidden && !open ? "-translate-y-full" : "translate-y-0"
        } ${scrolled ? "border-line bg-background/70 border-b backdrop-blur-xl" : "border-b border-transparent"}`}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-10">
          <Link
            href={home}
            className="font-display text-2xl leading-none tracking-tight"
            aria-label={studio.brand.name}
          >
            M<span className="text-ember italic">a</span>
          </Link>

          <nav aria-label={t.label} className="hidden md:block">
            <ul className="text-foreground/60 flex items-center gap-8 font-mono text-[11px] tracking-[0.2em] uppercase lg:gap-10">
              {SITE_ROUTES.map((r) => {
                const active = isActivePath(pathname, r.path);
                return (
                  <li key={r.key}>
                    <Link
                      href={localePath(locale, r.path)}
                      aria-current={active ? "page" : undefined}
                      className={`hover:text-foreground relative py-2 transition-colors ${active ? "text-foreground" : ""}`}
                    >
                      {t[r.key]}
                      {active ? (
                        <span
                          className="bg-ember absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full"
                          aria-hidden="true"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={contactHref}
              className="border-line hover:border-foreground hover:bg-foreground hover:text-background hidden rounded-full border px-4 py-2 text-[13px] transition-colors min-[420px]:inline-block"
            >
              {t.cta}
            </a>
            <button
              ref={menuButton}
              type="button"
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen(true)}
              className="border-line rounded-full border px-4 py-2 font-mono text-[11px] tracking-[0.18em] uppercase md:hidden"
            >
              {t.menu}
            </button>
          </div>
        </div>
      </header>

      {open
        ? createPortal(
            <div
              id="site-menu"
              role="dialog"
              aria-modal="true"
              aria-label={t.menu}
              data-lenis-prevent
              className="bg-background text-foreground fixed inset-0 z-[9500] flex flex-col overflow-y-auto px-5 pt-5 pb-10 md:hidden"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={home}
                  className="font-display text-2xl leading-none tracking-tight"
                >
                  M<span className="text-ember italic">a</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  autoFocus
                  className="border-line rounded-full border px-4 py-2 font-mono text-[11px] tracking-[0.18em] uppercase"
                >
                  {t.close}
                </button>
              </div>

              <nav aria-label={t.label} className="mt-auto pt-12">
                <ul className="flex flex-col">
                  {[{ key: "home" as const, path: "/" }, ...SITE_ROUTES].map(
                    (r, i) => (
                      <li key={r.key}>
                        <Link
                          href={localePath(locale, r.path)}
                          onClick={() => setOpen(false)}
                          aria-current={
                            (
                              r.path === "/"
                                ? pathname === home
                                : isActivePath(pathname, r.path)
                            )
                              ? "page"
                              : undefined
                          }
                          className="font-display border-line aria-[current=page]:text-ember flex items-baseline gap-4 border-b py-4 text-[clamp(2.4rem,11vw,3.75rem)] leading-none tracking-[-0.03em] motion-safe:animate-[site-menu-in_600ms_cubic-bezier(.2,.7,.1,1)_both]"
                          style={{ animationDelay: `${60 + i * 55}ms` }}
                        >
                          <span className="text-ember font-mono text-[11px] tracking-[0.2em]">
                            0{i + 1}
                          </span>
                          {t[r.key]}
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              </nav>
              <style>{`@keyframes site-menu-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}`}</style>

              <div className="text-muted-foreground mt-10 flex flex-col gap-5 font-mono text-[11px] tracking-[0.18em] uppercase">
                <a
                  href={`mailto:${EMAIL}`}
                  className="tracking-normal normal-case"
                >
                  {EMAIL}
                </a>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <span className="flex gap-4">
                    {SOCIALS.map((s) => (
                      <a
                        key={s.id}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.label}
                        <span className="sr-only">
                          {" "}
                          ({studio.contact.opensInNewTab})
                        </span>
                      </a>
                    ))}
                  </span>
                  <MotionToggle labels={studio.motion} />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
