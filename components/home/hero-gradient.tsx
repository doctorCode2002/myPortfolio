"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

import { useMotionAllowed } from "@/lib/motion";

const GrainGradient = dynamic(
  () =>
    import("@/components/vendor/componentry/grain-gradient").then(
      (m) => m.GrainGradient
    ),
  { ssr: false }
);

/**
 * Ember light bleeding in from the hero's lower corner. A static CSS gradient
 * paints with the HTML; the WebGL grain-gradient loads after first paint (idle)
 * and fades in over it. With motion off it renders one still frame.
 */
export function HeroGradient(): ReactNode {
  const allowed = useMotionAllowed();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setReady(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className="pointer-events-none absolute -end-[25%] -bottom-[30%] h-[115%] w-[95%] [mask-image:radial-gradient(closest-side,#000_35%,transparent)] rtl:-scale-x-100"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 60% 60%, #ff5a1f 0%, #6b1e06 45%, transparent 75%)",
          opacity: 0.75,
        }}
      />
      {ready ? (
        <div className="absolute inset-0 animate-[hero-fade_1.2s_ease_both]">
          <GrainGradient
            colorLight="#FF5A1F"
            colorMid="#6B1E06"
            colorDark="#0B0B0C"
            angle={-28}
            curve={0.6}
            softness={0.42}
            scale={1.1}
            grain={0.4}
            speed={allowed ? 0.6 : 0}
            seed={7}
          />
        </div>
      ) : null}
      <style>{`@keyframes hero-fade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
