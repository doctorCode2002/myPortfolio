"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import {
  CharacterPicker,
  hasSavedCharacter,
  loadSavedCharacter,
  saveCharacter,
  type CharacterId,
} from "./character-picker";
import { DialogueBox, type DialogueData } from "./dialogue-box";
import { gameEvents } from "./engine/events";
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
  const [selectedChar, setSelectedChar] = useState<CharacterId>(() => {
    if (typeof window !== "undefined") {
      return loadSavedCharacter();
    }
    return "char_0";
  });

  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return !hasSavedCharacter();
    }
    return false;
  });

  const [activeDialogue, setActiveDialogue] = useState<DialogueData | null>(
    null
  );

  // Lock scrolling on html and body on /play route
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // Subscribe to typed game events from Phaser
  useEffect(() => {
    const unbindNpc = gameEvents.on(
      "interact:npc",
      ({ charSheet, dialogueKey }) => {
        const lines = dict.play[dialogueKey];
        setActiveDialogue({
          title: dict.play.demoNpcName,
          subtitle: dict.play.demoNpcRole,
          portraitCharSheet: charSheet,
          lines: Array.isArray(lines) ? lines : [lines],
        });
      }
    );

    const unbindBuilding = gameEvents.on(
      "interact:building",
      ({ messageKey }) => {
        const lines = dict.play[messageKey];
        setActiveDialogue({
          title: dict.play.demoBuildingTitle,
          lines: Array.isArray(lines) ? lines : [lines],
        });
      }
    );

    return () => {
      unbindNpc();
      unbindBuilding();
    };
  }, [dict]);

  const handleSelectCharacter = (charId: CharacterId): void => {
    setSelectedChar(charId);
    saveCharacter(charId);
    setIsPickerOpen(false);
    gameEvents.emit("player:change-character", { charSheet: charId });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden select-none">
      <GameCanvas initialCharSheet={selectedChar} />

      <GameOverlay
        locale={locale}
        dict={dict}
        currentChar={selectedChar}
        onOpenCharacterPicker={() => setIsPickerOpen(true)}
      />

      <DialogueBox
        dialogue={activeDialogue}
        onClose={() => setActiveDialogue(null)}
        dict={dict}
        locale={locale}
      />

      <CharacterPicker
        isOpen={isPickerOpen}
        selectedChar={selectedChar}
        onSelect={handleSelectCharacter}
        onClose={selectedChar ? () => setIsPickerOpen(false) : undefined}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}
