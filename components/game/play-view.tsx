"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ISLANDS } from "@/lib/content/world";
import { getMayorDialogue } from "@/lib/content/world.selectors";
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
import { getBuildingPanel } from "@/lib/content/world.panels";

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

/** The 3D world (React Three Fiber); `?engine=2d` keeps the Phaser engine until 3D replaces it. */
const World3D = dynamic(
  () => import("../game3d/world3d").then((mod) => mod.World3D),
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

/** The 3D picker (live KayKit previews in one shared canvas), loaded on first open. */
const CharacterPicker3D = dynamic(
  () =>
    import("./picker3d/character-picker-3d").then(
      (mod) => mod.CharacterPicker3D
    ),
  { ssr: false }
);

const DevEditor =
  process.env.NODE_ENV !== "production"
    ? dynamic(
        () => import("./editor/dev-editor").then((mod) => mod.DevEditor),
        {
          ssr: false,
        }
      )
    : null;

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
  const [activeBuildingOverride, setActiveBuildingOverride] =
    useState<BuildingModalData | null>(null);
  const [panelDismissed, setPanelDismissed] = useState(false);

  const devPanel =
    process.env.NODE_ENV !== "production" &&
    isMounted &&
    typeof window !== "undefined"
      ? (() => {
          const p = new URLSearchParams(window.location.search).get("panel");
          return p ? getBuildingPanel(p, locale) : null;
        })()
      : null;

  const activeBuilding =
    activeBuildingOverride ?? (panelDismissed ? null : devPanel);

  const selectedChar =
    selectedCharOverride ?? (isMounted ? loadSavedCharacter() : "char_0");
  const isPickerOpen =
    pickerOpenOverride ?? (isMounted ? !hasSavedCharacter() : false);

  const isEditMode =
    process.env.NODE_ENV !== "production" &&
    isMounted &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("edit") === "1";

  // The Phaser engine stays reachable with ?engine=2d (and the dev editor needs it).
  const use2d =
    isMounted &&
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("engine") === "2d" ||
      isEditMode);

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
      ({
        npcId,
        charSheet,
        dialogueKey,
        title,
        subtitle,
        lines,
        nameKey,
        roleKey,
      }) => {
        const island = ISLANDS.find((isl) => isl.mayor?.id === npcId);
        if (island?.mayor) {
          const mayorDiag = getMayorDialogue(
            island.mayor,
            dict as unknown as Record<string, unknown>
          );
          setActiveDialogue({
            title: mayorDiag.name,
            subtitle: mayorDiag.title,
            portraitCharSheet: charSheet,
            lines: [...mayorDiag.lines],
          });
          return;
        }

        if (title && lines) {
          setActiveDialogue({
            title,
            subtitle,
            portraitCharSheet: charSheet,
            lines,
          });
        } else if (dialogueKey) {
          const rawLines = dict.play[dialogueKey as keyof typeof dict.play];
          const resolvedLines = Array.isArray(rawLines)
            ? (rawLines as string[])
            : [rawLines as string];
          setActiveDialogue({
            title: nameKey
              ? (dict.play[nameKey as keyof typeof dict.play] as string)
              : dict.play.demoNpcName,
            subtitle: roleKey
              ? (dict.play[roleKey as keyof typeof dict.play] as string)
              : dict.play.demoNpcRole,
            portraitCharSheet: charSheet,
            lines: resolvedLines,
          });
        }
      }
    );

    const unbindBuilding = gameEvents.on(
      "interact:building",
      ({ buildingId }) => {
        const panel = getBuildingPanel(buildingId, locale);
        if (panel) {
          setPanelDismissed(false);
          setActiveBuildingOverride(panel);
        }
      }
    );

    return () => {
      unbindNpc();
      unbindBuilding();
    };
  }, [dict, locale]);

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
      {use2d ? (
        <GameCanvas
          initialCharSheet={selectedChar}
          dict={dict}
          locale={locale}
        />
      ) : (
        <World3D charId={selectedChar} dict={dict} locale={locale} />
      )}

      <GameOverlay
        locale={locale}
        dict={dict}
        currentChar={selectedChar}
        onOpenCharacterPicker={() => setPickerOpenOverride(true)}
        portrait={use2d ? "2d" : "3d"}
      />

      <DialogueBox
        dialogue={activeDialogue}
        onClose={() => setActiveDialogue(null)}
        dict={dict}
        locale={locale}
      />

      <BuildingModal
        building={activeBuilding}
        onClose={() => {
          setActiveBuildingOverride(null);
          setPanelDismissed(true);
        }}
        dict={dict}
        locale={locale}
      />

      {use2d ? (
        <CharacterPicker
          isOpen={isPickerOpen}
          selectedChar={selectedChar}
          onSelect={handleSelectCharacter}
          onClose={selectedChar ? handleClosePicker : undefined}
          dict={dict}
          locale={locale}
        />
      ) : (
        <CharacterPicker3D
          isOpen={isPickerOpen}
          selectedChar={selectedChar}
          onSelect={handleSelectCharacter}
          onClose={selectedChar ? handleClosePicker : undefined}
          dict={dict}
          locale={locale}
        />
      )}

      {isEditMode && DevEditor && <DevEditor />}
    </div>
  );
}
