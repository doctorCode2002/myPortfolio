"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { GameOverlay } from "./game-overlay";

const GameCanvas = dynamic(
  () => import("./game-canvas").then((mod) => mod.GameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="bg-background flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      </div>
    ),
  }
);

export function PlayView({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}): ReactNode {
  return (
    <div className="relative h-screen w-full overflow-hidden select-none">
      <GameCanvas />
      <GameOverlay locale={locale} dict={dict} />
    </div>
  );
}
