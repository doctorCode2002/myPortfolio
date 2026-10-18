"use client";

import { ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { isRtl, type Locale } from "@/lib/i18n";
import { gameEvents } from "./engine/events";

export interface DialogueData {
  title: string;
  subtitle?: string | undefined;
  portraitCharSheet?: string | undefined;
  lines: string[];
  /** A yes/no question after the last line (the 3D mayors' tour offer). */
  choice?: DialogueChoice | undefined;
}

export interface DialogueChoice {
  prompt: string;
  /** Shown as a tag before the prompt when someone else asks it (e.g. "Narrator"). */
  speaker?: string | undefined;
  yes: string;
  no: string;
  onChoose: (accept: boolean) => void;
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
  const choice = dialogue.choice;
  const lines = choice ? [...dialogue.lines, choice.prompt] : dialogue.lines;
  const [focusYes, setFocusYes] = useState(true);
  const currentFullLine = lines[lineIndex] ?? "";
  const isTyping = charCount < currentFullLine.length;
  const onChoiceLine = Boolean(choice) && lineIndex >= lines.length - 1;
  const showChoice = onChoiceLine && !isTyping;
  const displayedText = currentFullLine.slice(0, charCount);

  // Freeze player movement while dialogue is open
  useEffect(() => {
    gameEvents.lockUi("dialogue");
    return () => {
      gameEvents.unlockUi("dialogue");
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
  const choose = useCallback(
    (accept: boolean): void => {
      choice?.onChoose(accept);
      onClose();
    },
    [choice, onClose]
  );

  const handleAdvance = useCallback((): void => {
    if (isTyping) {
      setCharCount(currentFullLine.length);
    } else {
      if (lineIndex < lines.length - 1) {
        setLineIndex((prev) => prev + 1);
        setCharCount(0);
      } else if (!choice) {
        onClose();
      }
    }
  }, [
    isTyping,
    currentFullLine.length,
    lineIndex,
    lines.length,
    onClose,
    choice,
  ]);

  // Keyboard navigation: Space, Enter, or E advances; Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (showChoice) {
        const k = e.key.toLowerCase();
        if (k === "arrowleft" || k === "arrowright" || k === "tab") {
          e.preventDefault();
          setFocusYes((v) => !v);
          return;
        }
        if (k === "y" || k === "n" || k === "escape") {
          e.preventDefault();
          choose(k === "y");
          return;
        }
        if (k === " " || k === "enter" || k === "e") {
          e.preventDefault();
          choose(focusYes);
          return;
        }
      }
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
  }, [handleAdvance, onClose, showChoice, choose, focusYes]);

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
        style={{
          boxShadow:
            "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, -2px -2px 0 0 #000, 2px -2px 0 0 #000, -2px 2px 0 0 #000, 2px 2px 0 0 #000, inset 0 0 0 2px #d4a359, inset 0 0 0 4px #261f18",
          imageRendering: "pixelated",
        }}
        className="bg-background pointer-events-auto relative flex w-full max-w-xl cursor-pointer flex-col gap-3 rounded-none p-5 shadow-2xl sm:flex-row sm:items-start sm:gap-4 sm:p-6"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={dict.play.dialogueClose}
          style={{
            boxShadow:
              "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000",
            imageRendering: "pixelated",
          }}
          className="focus-ring bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground absolute end-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-none transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* NPC Portrait */}
        {dialogue.portraitCharSheet && (
          <div className="flex shrink-0 items-center justify-center">
            <div
              style={{
                boxShadow:
                  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 2px #d4a359",
                imageRendering: "pixelated",
              }}
              className="bg-muted/80 flex h-16 w-16 items-center justify-center overflow-hidden rounded-none shadow-inner sm:h-20 sm:w-20"
            >
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
              <span className="text-muted-foreground font-mono text-xs">
                ({dialogue.subtitle})
              </span>
            )}
          </div>

          {/* Typewriter text line */}
          <p className="text-foreground/90 mt-2 min-h-12 text-sm leading-relaxed sm:text-base">
            {onChoiceLine && choice?.speaker ? (
              <span className="bg-muted text-muted-foreground me-2 inline-block rounded-sm px-1.5 py-0.5 align-middle font-mono text-[10px] tracking-wide uppercase">
                {choice.speaker}
              </span>
            ) : null}
            {displayedText}
            {isTyping && (
              <span className="bg-accent ms-1 inline-block h-3.5 w-1.5 animate-pulse" />
            )}
          </p>

          {showChoice && choice ? (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs">
              {[true, false].map((accept) => (
                <button
                  key={String(accept)}
                  type="button"
                  autoFocus={accept}
                  onClick={(e) => {
                    e.stopPropagation();
                    choose(accept);
                  }}
                  onFocus={() => setFocusYes(accept)}
                  data-dialogue-choice={accept ? "yes" : "no"}
                  className={`focus-ring rounded-none px-3 py-1.5 font-semibold transition-colors ${
                    focusYes === accept
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent/70"
                  }`}
                >
                  {accept ? choice.yes : choice.no}
                </button>
              ))}
            </div>
          ) : (
            /* Action indicator at bottom */
            <div className="text-muted-foreground mt-3 flex items-center justify-end gap-2 text-xs">
              <span className="font-medium">
                {isTyping
                  ? dict.play.dialogueNext
                  : isLastLine
                    ? dict.play.dialogueClose
                    : dict.play.dialogueNext}
              </span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
