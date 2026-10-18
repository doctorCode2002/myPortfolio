"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { features } from "@/lib/config";

/** Window events that pause and resume smooth scrolling. */
export const SMOOTH_SCROLL_PAUSE = "smoothscroll:pause";
export const SMOOTH_SCROLL_RESUME = "smoothscroll:resume";

const LENIS_OPTIONS = {
  duration: 1.6,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: "vertical" as const,
  gestureOrientation: "vertical" as const,
  smoothWheel: true,
  wheelMultiplier: 1,
  touchMultiplier: 2,
};

export function SmoothScroll({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    if (!features.smoothScroll) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const lenis = new Lenis(LENIS_OPTIONS);

    function raf(time: number): void {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    function handleAnchorClick(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const element = document.querySelector(href);
      if (!element) return;

      e.preventDefault();
      lenis.scrollTo(element as HTMLElement, { offset: -100 });
    }

    document.addEventListener("click", handleAnchorClick);

    // Overlays (e.g. the mobile menu) pause page scrolling while they're open.
    const pause = (): void => lenis.stop();
    const resume = (): void => lenis.start();
    window.addEventListener(SMOOTH_SCROLL_PAUSE, pause);
    window.addEventListener(SMOOTH_SCROLL_RESUME, resume);

    return () => {
      document.removeEventListener("click", handleAnchorClick);
      window.removeEventListener(SMOOTH_SCROLL_PAUSE, pause);
      window.removeEventListener(SMOOTH_SCROLL_RESUME, resume);
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
