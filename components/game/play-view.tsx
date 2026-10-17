"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { BuildingModal, type BuildingModalData } from "./building-modal";
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

const emptySubscribe = () => () => {};

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
  // Safe hydration mount detection without cascading renders
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [selectedCharOverride, setSelectedCharOverride] =
    useState<CharacterId | null>(null);
  const [pickerOpenOverride, setPickerOpenOverride] = useState<boolean | null>(
    null
  );
  const [activeDialogue, setActiveDialogue] = useState<DialogueData | null>(
    null
  );
  const [activeBuilding, setActiveBuilding] =
    useState<BuildingModalData | null>(null);

  const selectedChar =
    selectedCharOverride ?? (isMounted ? loadSavedCharacter() : "char_0");
  const isPickerOpen =
    pickerOpenOverride ?? (isMounted ? !hasSavedCharacter() : false);

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
        const rawLines = dict.play[dialogueKey];
        const lines = Array.isArray(rawLines) ? rawLines : [rawLines];
        setActiveDialogue({
          title: dict.play.demoNpcName,
          subtitle: dict.play.demoNpcRole,
          portraitCharSheet: charSheet,
          lines,
        });
      }
    );

    const unbindBuilding = gameEvents.on(
      "interact:building",
      ({ buildingId, titleKey, messageKey, title, lines }) => {
        const buildingData =
          dict.play.buildings?.[buildingId as keyof typeof dict.play.buildings];

        if (buildingData) {
          setActiveBuilding({
            id: buildingId,
            title: buildingData.title,
            sign: buildingData.sign,
            lines: buildingData.lines,
          });
        } else if (title && lines) {
          setActiveBuilding({
            id: buildingId,
            title,
            lines,
          });
        } else if (titleKey && messageKey) {
          const rawLines = dict.play[messageKey as keyof typeof dict.play];
          setActiveBuilding({
            id: buildingId,
            title: dict.play[titleKey as keyof typeof dict.play] as string,
            lines: Array.isArray(rawLines)
              ? (rawLines as string[])
              : [rawLines as string],
          });
        } else {
          setActiveBuilding({
            id: buildingId,
            title: dict.play.demoBuildingTitle,
            lines: dict.play.demoBuildingDialogue,
          });
        }
      }
    );

    return () => {
      unbindNpc();
      unbindBuilding();
    };
  }, [dict]);

  const handleSelectCharacter = (charId: CharacterId): void => {
    setSelectedCharOverride(charId);
    saveCharacter(charId);
    setPickerOpenOverride(false);
    gameEvents.unlockUi("picker");
    gameEvents.emit("player:change-character", { charSheet: charId });
  };

  const handleClosePicker = (): void => {
    setPickerOpenOverride(false);
    gameEvents.unlockUi("picker");
  };

  if (!isMounted) {
    return (
      <div className="bg-background flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden select-none">
      <GameCanvas initialCharSheet={selectedChar} />

      <GameOverlay
        locale={locale}
        dict={dict}
        currentChar={selectedChar}
        onOpenCharacterPicker={() => setPickerOpenOverride(true)}
      />

      <DialogueBox
        dialogue={activeDialogue}
        onClose={() => setActiveDialogue(null)}
        dict={dict}
        locale={locale}
      />

      <BuildingModal
        building={activeBuilding}
        onClose={() => setActiveBuilding(null)}
        dict={dict}
        locale={locale}
      />

      <CharacterPicker
        isOpen={isPickerOpen}
        selectedChar={selectedChar}
        onSelect={handleSelectCharacter}
        onClose={selectedChar ? handleClosePicker : undefined}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}
