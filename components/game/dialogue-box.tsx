"use client";

import { ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { isRtl, type Locale } from "@/lib/i18n";
import { gameEvents } from "./engine/events";

export interface DialogueData {
  title: string;
  subtitle?: string;
  portraitCharSheet?: string;
  lines: string[];
}

export function DialogueBox({
  dialogue,
  onClose,
  dict,
  locale,
}: {
  dialogue: DialogueData | null;
  onClose: () => void;
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  if (!dialogue) return null;

  return (
    <DialogueModal
      key={`${dialogue.title}-${dialogue.portraitCharSheet ?? ""}`}
      dialogue={dialogue}
      onClose={onClose}
      dict={dict}
      locale={locale}
    />
  );
}

function DialogueModal({
  dialogue,
  onClose,
  dict,
  locale,
}: {
  dialogue: DialogueData;
  onClose: () => void;
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const [lineIndex, setLineIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const rtl = isRtl(locale);
  const lines = dialogue.lines;
  const currentFullLine = lines[lineIndex] ?? "";
  const isTyping = charCount < currentFullLine.length;
  const displayedText = currentFullLine.slice(0, charCount);

  // Freeze player movement while dialogue is open
  useEffect(() => {
    gameEvents.emit("game:freeze", true);
    return () => {
      gameEvents.emit("game:freeze", false);
    };
  }, []);

  // Typewriter step effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCharCount((prev) => {
        if (prev < currentFullLine.length) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 22);

    return () => clearInterval(interval);
  }, [currentFullLine]);

  // Advance or skip typewriter
  const handleAdvance = useCallback((): void => {
    if (isTyping) {
      setCharCount(currentFullLine.length);
    } else {
      if (lineIndex < lines.length - 1) {
        setLineIndex((prev) => prev + 1);
        setCharCount(0);
      } else {
        onClose();
      }
    }
  }, [isTyping, currentFullLine.length, lineIndex, lines.length, onClose]);

  // Keyboard navigation: Space, Enter, or E advances; Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === " " || e.key === "Enter" || e.key.toLowerCase() === "e") {
        e.preventDefault();
        handleAdvance();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAdvance, onClose]);

  const isLastLine = lineIndex >= lines.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir={rtl ? "rtl" : "ltr"}
      className="animate-in fade-in slide-in-from-bottom-4 pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 duration-200 select-none"
    >
      <div
        onClick={handleAdvance}
        className="border-foreground/20 bg-background/95 pointer-events-auto relative flex w-full max-w-xl cursor-pointer flex-col gap-3 rounded-2xl border-2 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-start sm:gap-4 sm:p-6"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={dict.play.dialogueClose}
          className="focus-ring border-foreground/15 text-muted-foreground hover:border-accent hover:text-foreground absolute end-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* NPC Portrait */}
        {dialogue.portraitCharSheet && (
          <div className="flex shrink-0 items-center justify-center">
            <div className="border-accent/40 bg-muted/60 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-2 shadow-inner sm:h-20 sm:w-20">
              <div
                style={{
                  width: 16,
                  height: 32,
                  backgroundImage: `url(/game/characters/${dialogue.portraitCharSheet}.png)`,
                  backgroundPosition: "-16px 0px",
                  transform: "scale(2.5)",
                  imageRendering: "pixelated",
                }}
              />
            </div>
          </div>
        )}

        {/* Dialogue Text Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-base font-bold sm:text-lg">
              {dialogue.title}
            </span>
            {dialogue.subtitle && (
              <span className="text-muted-foreground text-xs">
                ({dialogue.subtitle})
              </span>
            )}
          </div>

          {/* Typewriter text line */}
          <p className="text-foreground/90 mt-2 min-h-12 text-sm leading-relaxed sm:text-base">
            {displayedText}
            {isTyping && (
              <span className="bg-accent ms-1 inline-block h-3.5 w-1.5 animate-pulse" />
            )}
          </p>

          {/* Action indicator at bottom */}
          <div className="text-muted-foreground mt-3 flex items-center justify-end gap-2 text-xs">
            <span>
              {isTyping
                ? dict.play.dialogueNext
                : isLastLine
                  ? dict.play.dialogueClose
                  : dict.play.dialogueNext}
            </span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
