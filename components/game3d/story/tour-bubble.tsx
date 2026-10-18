"use client";

import { Html } from "@react-three/drei";
import type { ReactNode } from "react";

import type { TourVoice } from "@/lib/content/tours";
import type { StoryLabels } from "./labels";
import type { BubbleKind } from "./mayor-brain";

/**
 * The line above a touring mayor. Narration (every line for a mayor who is a real client)
 * is tagged "Narrator" and set in italics, never as a quote; demo mayors' lines carry a
 * "Demo" tag. An "End tour" button works for mouse and touch; Esc ends it on a keyboard.
 */
export function TourBubble({
  kind,
  stop,
  total,
  voice,
  text,
  labels,
  rtl,
  onEnd,
}: {
  kind: BubbleKind;
  stop: number;
  total: number;
  voice: TourVoice;
  text: string;
  labels: StoryLabels;
  rtl: boolean;
  onEnd: () => void;
}): ReactNode {
  const narrator = voice === "narrator";
  const n = Math.min(stop + 1, total);
  return (
    <Html
      position={[0, 1.55, 0]}
      center
      zIndexRange={[34, 31]}
      style={{ pointerEvents: "none" }}
    >
      <div
        dir={rtl ? "rtl" : "ltr"}
        role="status"
        aria-live="polite"
        className="border-foreground/15 bg-background/92 text-foreground flex w-[15rem] -translate-y-full flex-col gap-1.5 rounded-xl border px-3 py-2 text-start text-xs shadow-lg backdrop-blur-md sm:w-[17rem] sm:text-sm"
        data-tour-bubble={kind}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase ${
              narrator
                ? "bg-muted text-muted-foreground"
                : "bg-accent/20 text-accent"
            }`}
          >
            {narrator ? labels.narrator : labels.demo}
          </span>
          {kind !== "done" ? (
            <span className="text-muted-foreground text-[10px]">
              {labels.progress
                .replace("{n}", String(n))
                .replace("{total}", String(total))}
            </span>
          ) : null}
        </div>
        <p className={`leading-snug ${narrator ? "italic" : ""}`}>{text}</p>
        {kind !== "done" ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-[10px] pointer-coarse:hidden">
              {labels.escHint}
            </span>
            <button
              type="button"
              onClick={onEnd}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-muted hover:bg-accent hover:text-accent-foreground pointer-events-auto ms-auto rounded-md px-2 py-1 text-[11px] font-semibold transition-colors"
              data-tour-end
            >
              {labels.end}
            </button>
          </div>
        ) : null}
      </div>
    </Html>
  );
}
