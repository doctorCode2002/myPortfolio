"use client";

import type { ReactNode } from "react";

import { setMotionAllowed, useMotionAllowed } from "@/lib/motion";

type Labels = { on: string; off: string; toggle: string };

/**
 * The site-wide "pause all motion" control (WCAG 2.2.2). A switch, so its
 * state is announced; the visible label says what is true right now.
 */
export function MotionToggle({
  labels,
  className = "",
}: {
  labels: Labels;
  className?: string;
}): ReactNode {
  const allowed = useMotionAllowed();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={allowed}
      aria-label={labels.toggle}
      onClick={() => setMotionAllowed(!allowed)}
      className={`group hover:text-foreground inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-3.5 w-6 items-center rounded-full border transition-colors ${
          allowed ? "border-ember bg-ember/20" : "border-line bg-transparent"
        }`}
      >
        <span
          className={`absolute size-2 rounded-full transition-transform ${
            allowed
              ? "bg-ember translate-x-[11px] rtl:-translate-x-[11px]"
              : "bg-muted-foreground translate-x-[3px] rtl:-translate-x-[3px]"
          }`}
        />
      </span>
      {allowed ? labels.on : labels.off}
    </button>
  );
}
