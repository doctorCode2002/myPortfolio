"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { useIntroDone } from "@/components/site/intro-state";
import { isMotionAllowed } from "@/lib/motion";

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The hero headline. It is server-rendered and painted on first paint (it is
 * the LCP element), so it is never hidden from crawlers or the LCP clock.
 *
 * The rise-through-a-mask reveal only plays when the intro curtain is up: the
 * lines are tucked below their masks while covered, then rise as the curtain
 * lifts. On a return visit (no intro) or with motion off it simply stays put —
 * no flash of hidden text.
 */
export function HeroHeadline({
  lineA,
  lineB,
}: {
  lineA: string;
  lineB: string;
}): ReactNode {
  const lines = useRef<(HTMLSpanElement | null)[]>([]);
  const armed = useRef(false);
  const introDone = useIntroDone();

  // Before paint: if the intro will cover the page, tuck the lines away.
  useIsoLayoutEffect(() => {
    if (
      !document.documentElement.hasAttribute("data-intro") ||
      !isMotionAllowed()
    )
      return;
    armed.current = true;
    for (const l of lines.current)
      if (l) l.style.transform = "translateY(105%)";
  }, []);

  useEffect(() => {
    if (!introDone || !armed.current) return;
    armed.current = false;
    lines.current.forEach((l, i) => {
      if (!l) return;
      const a = l.animate(
        [{ transform: "translateY(105%)" }, { transform: "translateY(0)" }],
        {
          duration: 1100,
          delay: 120 + i * 110,
          easing: "cubic-bezier(.2,.7,.1,1)",
          fill: "backwards",
        }
      );
      l.style.transform = "";
      void a.finished.catch(() => {});
    });
  }, [introDone]);

  return (
    <h1 className="font-display text-[clamp(3.2rem,min(11vw,19vh),11rem)] leading-[0.9] font-normal tracking-[-0.035em] rtl:text-[clamp(2.6rem,min(9vw,15vh),8rem)]">
      <span className="block overflow-hidden pb-[0.06em]">
        <span
          ref={(el) => void (lines.current[0] = el)}
          className="block will-change-transform"
        >
          {lineA}
        </span>
      </span>
      <span className="block overflow-hidden pb-[0.08em]">
        <span
          ref={(el) => void (lines.current[1] = el)}
          className="text-foreground/90 block italic will-change-transform"
        >
          {lineB}
        </span>
      </span>
    </h1>
  );
}
