"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";

export const AVAILABLE_CHARACTERS = [
  "char_0",
  "char_1",
  "char_2",
  "char_3",
  "char_4",
  "char_5",
] as const;

export type CharacterId = (typeof AVAILABLE_CHARACTERS)[number];

const STORAGE_KEY = "portfolio_game_char";

export function loadSavedCharacter(): CharacterId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (AVAILABLE_CHARACTERS as readonly string[]).includes(saved)) {
      return saved as CharacterId;
    }
  } catch {
    // localStorage may be disabled or restricted
  }
  return "char_0";
}

export function hasSavedCharacter(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function saveCharacter(id: CharacterId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage may be disabled or restricted
  }
}

export function CharacterPicker({
  isOpen,
  selectedChar,
  onSelect,
  onClose,
  dict,
}: {
  isOpen: boolean;
  selectedChar: string;
  onSelect: (charId: CharacterId) => void;
  onClose?: (() => void) | undefined;
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const [activeFrame, setActiveFrame] = useState(0);
  const [highlighted, setHighlighted] = useState<CharacterId>(
    (selectedChar as CharacterId) || "char_0"
  );

  // Animate character walk cycle (frames 0, 1, 2, 1)
  useEffect(() => {
    if (!isOpen) return;
    const walkFrames = [0, 1, 2, 1];
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % walkFrames.length;
      setActiveFrame(walkFrames[step] ?? 1);
    }, 140);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      const curIdx = AVAILABLE_CHARACTERS.indexOf(highlighted);
      if (curIdx === -1) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (curIdx + 1) % AVAILABLE_CHARACTERS.length;
        setHighlighted(AVAILABLE_CHARACTERS[next] ?? "char_0");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev =
          (curIdx - 1 + AVAILABLE_CHARACTERS.length) %
          AVAILABLE_CHARACTERS.length;
        setHighlighted(AVAILABLE_CHARACTERS[prev] ?? "char_0");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = (curIdx + 3) % AVAILABLE_CHARACTERS.length;
        setHighlighted(AVAILABLE_CHARACTERS[next] ?? "char_0");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev =
          (curIdx - 3 + AVAILABLE_CHARACTERS.length) %
          AVAILABLE_CHARACTERS.length;
        setHighlighted(AVAILABLE_CHARACTERS[prev] ?? "char_0");
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(highlighted);
      } else if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, highlighted, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dict.play.chooseCharacter}
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md duration-200 select-none"
    >
      <div className="border-foreground/20 bg-background/95 relative w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl backdrop-blur-xl">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.play.dialogueClose}
            className="focus-ring border-foreground/15 text-muted-foreground hover:border-accent hover:text-foreground absolute end-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Modal Header */}
        <div className="mb-6 text-center">
          <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
            {dict.play.chooseCharacter}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {dict.play.pickerSubtitle}
          </p>
        </div>

        {/* Character Grid */}
        <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
          {AVAILABLE_CHARACTERS.map((charId, index) => {
            const isSelected = highlighted === charId;
            return (
              <button
                key={charId}
                type="button"
                onClick={() => setHighlighted(charId)}
                onDoubleClick={() => onSelect(charId)}
                className={`focus-ring relative flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all duration-150 ${
                  isSelected
                    ? "border-accent bg-accent/15 ring-accent/30 scale-105 shadow-md ring-2"
                    : "border-foreground/10 bg-muted/30 hover:border-foreground/30 hover:bg-muted/60"
                }`}
              >
                {isSelected && (
                  <div className="bg-accent text-accent-foreground absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}

                {/* Animated Character Preview (3x pixel scaling) */}
                <div className="flex h-24 w-12 items-center justify-center overflow-hidden">
                  <div
                    style={{
                      width: 16,
                      height: 32,
                      backgroundImage: `url(/game/characters/${charId}.png)`,
                      backgroundPosition: `-${activeFrame * 16}px 0px`,
                      transform: "scale(2.5)",
                      imageRendering: "pixelated",
                    }}
                  />
                </div>

                <span className="text-foreground mt-2 font-mono text-xs font-medium">
                  #{index + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Confirm Button */}
        <button
          type="button"
          onClick={() => onSelect(highlighted)}
          className="focus-ring bg-accent text-accent-foreground w-full cursor-pointer rounded-xl px-4 py-3 text-center text-sm font-semibold shadow-sm transition-transform hover:opacity-95 active:scale-[0.98]"
        >
          {dict.play.startExploring}
        </button>
      </div>
    </div>
  );
}
