import { ArrowLeft, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { AtmosphereControls } from "@/components/game3d/atmosphere/atmosphere-controls";
import { localePath, type Locale } from "@/lib/i18n";
import { gameEvents } from "./engine/events";
import { CharacterPortrait } from "./picker3d/character-portrait";

export function GameOverlay({
  locale,
  dict,
  currentChar,
  onOpenCharacterPicker,
  portrait = "3d",
}: {
  locale: Locale;
  dict: Dictionary;
  currentChar: string;
  onOpenCharacterPicker: () => void;
  /** "3d": the pre-rendered 3D portrait; "2d": the Phaser engine's pixel sprite. */
  portrait?: "3d" | "2d";
}): ReactNode {
  const [currentZoom, setCurrentZoom] = useState(2);

  useEffect(() => {
    return gameEvents.on("camera:zoom-changed", ({ zoom }) => {
      setCurrentZoom(zoom);
    });
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden select-none">
      {/* Top controls, stacked: "Back to portfolio", then "Change character", then zoom */}
      <div className="pointer-events-auto absolute start-4 top-4 flex flex-col items-start gap-2 sm:start-6 sm:top-6">
        <Link
          href={localePath(locale, "/")}
          className="group focus-ring border-foreground/15 bg-background/85 text-foreground hover:border-accent/40 hover:bg-background inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-all duration-200 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" />
          <span>{dict.play.backToPortfolio}</span>
        </Link>

        <button
          type="button"
          onClick={onOpenCharacterPicker}
          className="focus-ring border-foreground/15 bg-background/85 text-foreground hover:border-accent/40 hover:bg-background inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-all duration-200 sm:text-sm"
        >
          {portrait === "3d" ? (
            <CharacterPortrait
              charId={currentChar}
              size={24}
              className="-my-1 -ms-1.5 ring-1 ring-black/10"
            />
          ) : (
            <div className="flex h-4 w-3 items-center justify-center overflow-hidden">
              <div
                style={{
                  width: 16,
                  height: 32,
                  backgroundImage: `url(/game/characters/${currentChar}.png)`,
                  backgroundPosition: "-16px 0px",
                  transform: "scale(1.1)",
                  imageRendering: "pixelated",
                }}
              />
            </div>
          )}
          <span>{dict.play.changeCharacter}</span>
          {dict.play.charNames[
            currentChar as keyof typeof dict.play.charNames
          ] && (
            <span className="text-muted-foreground font-semibold">
              (
              {
                dict.play.charNames[
                  currentChar as keyof typeof dict.play.charNames
                ]
              }
              )
            </span>
          )}
        </button>

        {/* Zoom Controls (+ / -) for accessibility */}
        <div className="border-foreground/15 bg-background/85 flex items-center rounded-full border shadow-sm backdrop-blur-md">
          <button
            type="button"
            onClick={() => gameEvents.emit("camera:zoom-out")}
            aria-label="Zoom out"
            className="focus-ring text-muted-foreground hover:text-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="text-foreground min-w-7 text-center font-mono text-xs font-semibold">
            {currentZoom}x
          </span>
          <button
            type="button"
            onClick={() => gameEvents.emit("camera:zoom-in")}
            aria-label="Zoom in"
            className="focus-ring text-muted-foreground hover:text-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 3D only: ambient sound and time of day. */}
        {portrait === "3d" && <AtmosphereControls dict={dict} />}
      </div>

      {/* Controls HUD pill at bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4 sm:bottom-6">
        <div className="border-foreground/10 bg-background/80 text-muted-foreground flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur-md sm:text-xs">
          <span className="hidden sm:inline">{dict.play.instructions}</span>
          <span className="sm:hidden">{dict.play.touchInstructions}</span>
        </div>
      </div>
    </div>
  );
}
