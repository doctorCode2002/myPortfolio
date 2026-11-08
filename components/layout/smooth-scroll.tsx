"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { features } from "@/lib/config";
import { useMotionAllowed } from "@/lib/motion";

/** Window events that pause and resume smooth scrolling. */
export const SMOOTH_SCROLL_PAUSE = "smoothscroll:pause";
export const SMOOTH_SCROLL_RESUME = "smoothscroll:resume";

const LENIS_OPTIONS = {
  duration: 1.4,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  // Touch keeps the platform's native scrolling.
  syncTouch: false,
  anchors: { offset: -90 },
};

/**
 * Lenis smooth scrolling while motion is allowed; native scrolling the moment
 * the Motion toggle (or the OS setting) turns it off. Regions marked
 * `data-lenis-prevent` (menus, modals) scroll natively.
 */
export function SmoothScroll({ children }: { children: ReactNode }): ReactNode {
  const allowed = useMotionAllowed();
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!features.smoothScroll || !allowed) return;

    const lenis = new Lenis(LENIS_OPTIONS);
    lenisRef.current = lenis;
    let rafId = 0;
    const raf = (time: number): void => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    const pause = (): void => lenis.stop();
    const resume = (): void => lenis.start();
    window.addEventListener(SMOOTH_SCROLL_PAUSE, pause);
    window.addEventListener(SMOOTH_SCROLL_RESUME, resume);

    return () => {
      window.removeEventListener(SMOOTH_SCROLL_PAUSE, pause);
      window.removeEventListener(SMOOTH_SCROLL_RESUME, resume);
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [allowed]);

  // New route → start at the top (Lenis keeps its own scroll position).
  useEffect(() => {
    if (window.location.hash) return;
    lenisRef.current?.scrollTo(0, { immediate: true });
  }, [pathname]);

  return <>{children}</>;
}
