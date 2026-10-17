"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { isRtl, type Locale } from "@/lib/i18n";
import { gameEvents } from "./engine/events";

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
const PIXEL_FRAME =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, -2px -2px 0 0 #000, 2px -2px 0 0 #000, -2px 2px 0 0 #000, 2px 2px 0 0 #000, inset 0 0 0 2px #d4a359, inset 0 0 0 4px #261f18";
const PIXEL_BTN =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000";
const PIXEL_SEL =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 2px #d4a359";
const PIXEL_UNSEL =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 1px rgba(255,255,255,0.08)";
const PIXEL_CONFIRM =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 2px rgba(255,255,255,0.2)";

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
  locale,
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

  const rtl = isRtl(locale);

  // Lock UI whenever picker is open
  useEffect(() => {
    if (!isOpen) return;
    gameEvents.lockUi("picker");
    return () => {
      gameEvents.unlockUi("picker");
    };
  }, [isOpen]);

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

      const nextIdx =
        e.key === "ArrowRight"
          ? (curIdx + 1) % AVAILABLE_CHARACTERS.length
          : e.key === "ArrowLeft"
            ? (curIdx - 1 + AVAILABLE_CHARACTERS.length) %
              AVAILABLE_CHARACTERS.length
            : e.key === "ArrowDown"
              ? (curIdx + 3) % AVAILABLE_CHARACTERS.length
              : e.key === "ArrowUp"
                ? (curIdx - 3 + AVAILABLE_CHARACTERS.length) %
                  AVAILABLE_CHARACTERS.length
                : null;

      if (nextIdx !== null) {
        e.preventDefault();
        setHighlighted(AVAILABLE_CHARACTERS[nextIdx] ?? "char_0");
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        gameEvents.unlockUi("picker");
        onSelect(highlighted);
      } else if (e.key === "Escape" && onClose) {
        e.preventDefault();
        gameEvents.unlockUi("picker");
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, highlighted, onSelect, onClose]);

  if (!isOpen) return null;

  const handleConfirm = (): void => {
    gameEvents.unlockUi("picker");
    onSelect(highlighted);
  };

  const handleClose = (): void => {
    gameEvents.unlockUi("picker");
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir={rtl ? "rtl" : "ltr"}
      aria-label={dict.play.chooseCharacter}
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200 select-none"
    >
      <div
        style={{ boxShadow: PIXEL_FRAME, imageRendering: "pixelated" }}
        className="bg-background relative w-full max-w-md rounded-none p-6 shadow-2xl"
      >
        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            aria-label={dict.play.dialogueClose}
            style={{ boxShadow: PIXEL_BTN, imageRendering: "pixelated" }}
            className="focus-ring bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground absolute end-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-none transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="mb-6 text-center">
          <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
            {dict.play.chooseCharacter}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {dict.play.pickerSubtitle}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
          {AVAILABLE_CHARACTERS.map((charId, index) => {
            const isSelected = highlighted === charId;
            const name = dict.play.charNames[charId] ?? `#${index + 1}`;
            return (
              <button
                key={charId}
                type="button"
                onClick={() => setHighlighted(charId)}
                onDoubleClick={handleConfirm}
                style={{
                  boxShadow: isSelected ? PIXEL_SEL : PIXEL_UNSEL,
                  imageRendering: "pixelated",
                }}
                className={`focus-ring relative flex cursor-pointer flex-col items-center justify-center rounded-none p-3 transition-transform ${
                  isSelected
                    ? "bg-accent/15 scale-105"
                    : "bg-muted/40 hover:bg-muted/70"
                }`}
              >
                {isSelected && (
                  <div className="bg-accent text-accent-foreground absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-none">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}

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

                <span className="text-foreground mt-2 text-xs font-semibold tracking-wide">
                  {name}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          style={{ boxShadow: PIXEL_CONFIRM, imageRendering: "pixelated" }}
          className="focus-ring bg-accent text-accent-foreground w-full cursor-pointer rounded-none px-4 py-3 text-center text-sm font-semibold tracking-wide transition-opacity hover:opacity-90 active:translate-y-0.5"
        >
          {dict.play.startExploring}
        </button>
      </div>
    </div>
  );
}
