"use client";

import { Building2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { isRtl, type Locale } from "@/lib/i18n";
import { gameEvents } from "./engine/events";

export interface BuildingModalData {
  id: string;
  title: string;
  lines: string[];
}

export function BuildingModal({
  building,
  onClose,
  dict,
  locale,
}: {
  building: BuildingModalData | null;
  onClose: () => void;
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const rtl = isRtl(locale);

  // Lock UI while building modal is active
  useEffect(() => {
    if (!building) return;
    gameEvents.lockUi("building");
    return () => {
      gameEvents.unlockUi("building");
    };
  }, [building]);

  // Handle keyboard dismiss
  useEffect(() => {
    if (!building) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [building, onClose]);

  if (!building) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir={rtl ? "rtl" : "ltr"}
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200 select-none"
    >
      <div
        style={{
          boxShadow:
            "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, -2px -2px 0 0 #000, 2px -2px 0 0 #000, -2px 2px 0 0 #000, 2px 2px 0 0 #000, inset 0 0 0 2px #d4a359, inset 0 0 0 4px #261f18",
          imageRendering: "pixelated",
        }}
        className="bg-background relative w-full max-w-lg rounded-none p-6 shadow-2xl"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={dict.play.dialogueClose}
          style={{
            boxShadow:
              "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000",
            imageRendering: "pixelated",
          }}
          className="focus-ring bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground absolute end-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-none transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header with Pixel Building Icon */}
        <div className="mb-4 flex items-center gap-3">
          <div
            style={{
              boxShadow:
                "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 2px #d4a359",
              imageRendering: "pixelated",
            }}
            className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-none text-[#ab4c24]"
          >
            <Building2 className="h-6 w-6 stroke-[2.5]" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-lg font-bold sm:text-xl">
                {building.title}
              </h2>
              <span
                style={{
                  boxShadow:
                    "0 -1px 0 0 #000, 0 1px 0 0 #000, -1px 0 0 0 #000, 1px 0 0 0 #000",
                }}
                className="bg-accent/20 text-accent px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase"
              >
                {dict.play.buildingStatus}
              </span>
            </div>
            <span className="text-muted-foreground font-mono text-xs">
              {dict.play.demoBuildingSign}
            </span>
          </div>
        </div>

        {/* Content Paragraphs */}
        <div className="text-foreground/90 mb-6 space-y-2.5 text-sm leading-relaxed sm:text-base">
          {building.lines.map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            boxShadow:
              "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 2px rgba(255,255,255,0.2)",
            imageRendering: "pixelated",
          }}
          className="focus-ring bg-accent text-accent-foreground w-full cursor-pointer rounded-none px-4 py-2.5 text-center text-sm font-semibold tracking-wide transition-opacity hover:opacity-90 active:translate-y-0.5"
        >
          {dict.play.buildingClose}
        </button>
      </div>
    </div>
  );
}
