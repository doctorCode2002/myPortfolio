"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { localePath, type Locale } from "@/lib/i18n";
import {
  LanguageSwitch,
  NAV_ROUTES,
  NavThemeToggle,
  useActiveRouteIndex,
  type NavLabels,
} from "./nav-parts";
import { SMOOTH_SCROLL_PAUSE, SMOOTH_SCROLL_RESUME } from "./smooth-scroll";

gsap.registerPlugin(useGSAP);

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Below the `sm` breakpoint the nav is a single icon button that opens a full-screen
 * menu animated with GSAP.
 *
 * No flash of unstyled content: the overlay's server HTML is already hidden by CSS
 * (`invisible opacity-0`, i.e. visibility:hidden + opacity 0) and `inert`, so it can
 * never paint or take focus before JS runs. GSAP only ever animates from that state
 * with `autoAlpha` (opacity + visibility together), using `fromTo` so the start values
 * are explicit. Without JS, a <noscript> style in nav.tsx shows the regular pill instead.
 */
export function MobileMenu({
  locale,
  labels,
}: {
  locale: Locale;
  labels: NavLabels;
}): ReactNode {
  const activeIndex = useActiveRouteIndex(locale);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  // `open` drives aria-expanded and the icon; `shown` keeps the overlay interactive
  // (not inert) from the start of the opening animation to the end of the closing one.
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: "power3.out" },
        onReverseComplete: () => setShown(false),
      });
      tl.fromTo(
        overlay.current,
        { autoAlpha: 0, clipPath: "inset(0% 0% 100% 0%)" },
        {
          autoAlpha: 1,
          clipPath: "inset(0% 0% 0% 0%)",
          duration: 0.6,
          ease: "power4.inOut",
        }
      )
        .fromTo(
          "[data-menu-link]",
          { yPercent: 110 },
          { yPercent: 0, duration: 0.6, stagger: 0.06 },
          "-=0.25"
        )
        .fromTo(
          "[data-menu-foot]",
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.4 },
          "-=0.35"
        );
      if (reduceMotion) tl.timeScale(1000);
      timeline.current = tl;
    },
    { scope: root }
  );

  const lockScroll = useCallback((lock: boolean) => {
    document.documentElement.style.overflow = lock ? "hidden" : "";
    window.dispatchEvent(
      new Event(lock ? SMOOTH_SCROLL_PAUSE : SMOOTH_SCROLL_RESUME)
    );
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
    setShown(true);
    lockScroll(true);
    timeline.current?.timeScale(1).play();
    // Focus the current page's link (or the first) once the overlay is visible.
    window.setTimeout(() => {
      const links = overlay.current?.querySelectorAll<HTMLElement>("a[href]");
      const current = overlay.current?.querySelector<HTMLElement>(
        'a[aria-current="page"]'
      );
      (current ?? links?.[0])?.focus();
    }, 60);
  }, [lockScroll]);

  const closeMenu = useCallback(
    ({ instant = false, restoreFocus = true } = {}) => {
      setOpen(false);
      lockScroll(false);
      const tl = timeline.current;
      if (tl) {
        if (instant) {
          tl.pause(0);
          setShown(false);
        } else {
          tl.timeScale(1.6).reverse();
        }
      }
      if (restoreFocus) toggle.current?.focus();
    },
    [lockScroll]
  );

  // Escape closes; Tab stays inside the toggle + menu while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        return;
      }
      if (e.key !== "Tab" || !root.current) return;
      const items = Array.from(
        root.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null || el === toggle.current);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeMenu]);

  // Growing past `sm` closes it at once (the pill takes over).

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 640px)");
    const onChange = (): void => {
      if (wide.matches && open)
        closeMenu({ instant: true, restoreFocus: false });
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open, closeMenu]);

  // Never leave the page locked if this unmounts while open.
  useEffect(() => () => lockScroll(false), [lockScroll]);

  return (
    <div ref={root} className="sm:hidden">
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? labels.closeMenu : labels.openMenu}
        onClick={() => (open ? closeMenu() : openMenu())}
        className="nav-mobile-toggle focus-ring border-foreground/10 bg-background fixed end-4 top-5 z-[70] inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border shadow-sm"
      >
        <span aria-hidden="true" className="relative block h-3 w-5">
          <span
            className={`bg-foreground absolute inset-x-0 h-0.5 rounded-full transition-transform duration-300 ${
              open ? "top-[5px] rotate-45" : "top-0"
            }`}
          />
          <span
            className={`bg-foreground absolute inset-x-0 h-0.5 rounded-full transition-transform duration-300 ${
              open ? "top-[5px] -rotate-45" : "top-2.5"
            }`}
          />
        </span>
      </button>

      <div
        ref={overlay}
        id={menuId}
        role="dialog"
        aria-modal="true"
        aria-label={labels.menuTitle}
        inert={!shown}
        className="bg-background invisible fixed inset-0 z-[60] flex flex-col overflow-y-auto px-6 pt-24 pb-10 opacity-0"
      >
        <ul className="flex flex-1 flex-col justify-center gap-2">
          {NAV_ROUTES.map((route, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={route.key} className="overflow-hidden">
                <Link
                  data-menu-link
                  href={localePath(locale, route.path)}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => closeMenu({ restoreFocus: false })}
                  className={`focus-ring inline-block py-1 font-serif text-[2.75rem] leading-[1.1] font-medium transition-colors ${
                    isActive
                      ? "text-accent"
                      : "text-foreground hover:text-accent"
                  }`}
                >
                  {labels[route.key]}
                </Link>
              </li>
            );
          })}
        </ul>
        <div
          data-menu-foot
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a[href]"))
              closeMenu({ restoreFocus: false });
          }}
          className="border-foreground/10 flex items-center justify-between border-t pt-6"
        >
          <span className="text-muted-foreground text-sm">
            {labels.menuTitle}
          </span>
          <div className="flex items-center gap-2">
            <LanguageSwitch locale={locale} labels={labels} />
            <NavThemeToggle labels={labels} />
          </div>
        </div>
      </div>
    </div>
  );
}
