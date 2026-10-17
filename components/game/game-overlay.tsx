import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";

export function GameOverlay({
  locale,
  dict,
  currentChar,
  onOpenCharacterPicker,
}: {
  locale: Locale;
  dict: Dictionary;
  currentChar: string;
  onOpenCharacterPicker: () => void;
}): ReactNode {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden select-none">
      {/* Top Controls: "Back to portfolio" and "Change character" */}
      <div className="pointer-events-auto absolute start-4 top-20 flex flex-wrap items-center gap-2 sm:start-6 sm:top-6">
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
          <span>{dict.play.changeCharacter}</span>
        </button>
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
