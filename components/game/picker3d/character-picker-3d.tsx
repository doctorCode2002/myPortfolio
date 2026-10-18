"use client";

import { Check, Lock, X } from "lucide-react";
import dynamic from "next/dynamic";
import {
  createRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { isRtl, type Locale } from "@/lib/i18n";
import { AVAILABLE_CHARACTERS, type CharacterId } from "../character-picker";
import { gameEvents } from "../engine/events";
import { usePickerControls } from "./use-picker-controls";
import { usePickerModels } from "./use-picker-manifest";
import {
  getMetaSnapshot,
  getServerMetaSnapshot,
  setSetting,
  subscribeMeta,
} from "@/components/game3d/meta/store";
import { allShardsFound } from "@/components/game3d/meta/progress";

/** The hidden 7th option: a golden-cloaked rogue, earned by finding every sky shard. */
const GOLDEN = "char_gold";
const GOLDEN_BASE: CharacterId = "char_4";
type PickerId = CharacterId | typeof GOLDEN;
const PICKER_IDS: readonly PickerId[] = [...AVAILABLE_CHARACTERS, GOLDEN];

const PreviewCanvas = dynamic(
  () => import("./preview-canvas").then((m) => m.PreviewCanvas),
  { ssr: false }
);

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

/** The world's sunset, softened: lavender-blue sky down to a peach horizon. */
const CARD_SKY =
  "linear-gradient(180deg, rgba(74,114,168,0.30) 0%, rgba(185,167,208,0.30) 45%, rgba(248,180,135,0.42) 100%)";
const FOOT_SHADOW =
  "radial-gradient(ellipse at center, rgba(38,31,24,0.38) 0%, rgba(38,31,24,0) 70%)";

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/**
 * The 3D character picker: the same dialog, storage, keys and locks as the pixel picker,
 * but each card shows its real KayKit character idling in a shared WebGL canvas.
 */
export function CharacterPicker3D({
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
  if (!isOpen) return null;
  return (
    <PickerDialog
      selectedChar={selectedChar}
      onSelect={onSelect}
      onClose={onClose}
      dict={dict}
      locale={locale}
    />
  );
}

function PickerDialog({
  selectedChar,
  onSelect,
  onClose,
  dict,
  locale,
}: {
  selectedChar: string;
  onSelect: (charId: CharacterId) => void;
  onClose?: (() => void) | undefined;
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const rtl = isRtl(locale);
  const meta = useSyncExternalStore(
    subscribeMeta,
    getMetaSnapshot,
    getServerMetaSnapshot
  );
  const goldUnlocked = allShardsFound(meta.progress);
  const [highlighted, setHighlighted] = useState<PickerId>(() =>
    goldUnlocked &&
    meta.progress.settings.goldCloak &&
    selectedChar === GOLDEN_BASE
      ? GOLDEN
      : (AVAILABLE_CHARACTERS as readonly string[]).includes(selectedChar)
        ? (selectedChar as CharacterId)
        : "char_0"
  );
  const [hovered, setHovered] = useState<PickerId | null>(null);
  const [focused, setFocused] = useState<PickerId | null>(null);
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());

  const wide = useMediaQuery("(min-width: 640px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const columns = wide ? 3 : 2;

  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [previewRefs] = useState(
    () =>
      Object.fromEntries(
        PICKER_IDS.map((id) => [id, createRef<HTMLDivElement>()])
      ) as Record<PickerId, RefObject<HTMLDivElement | null>>
  );
  const cardRefs = useRef<Partial<Record<PickerId, HTMLButtonElement>>>({});

  const { ready: manifestReady, models } =
    usePickerModels(AVAILABLE_CHARACTERS);

  const locked = highlighted === GOLDEN && !goldUnlocked;
  const handleConfirm = useCallback((): void => {
    if (highlighted === GOLDEN && !goldUnlocked) return;
    setSetting("goldCloak", highlighted === GOLDEN);
    gameEvents.unlockUi("picker");
    onSelect(highlighted === GOLDEN ? GOLDEN_BASE : highlighted);
  }, [highlighted, onSelect, goldUnlocked]);

  const handleClose = useCallback((): void => {
    gameEvents.unlockUi("picker");
    onClose?.();
  }, [onClose]);

  const focusCard = useCallback((id: PickerId): void => {
    cardRefs.current[id]?.focus();
  }, []);

  usePickerControls({
    isOpen: true,
    ids: PICKER_IDS,
    highlighted,
    setHighlighted,
    columns,
    rtl,
    dialogRef,
    onConfirm: handleConfirm,
    onClose: onClose ? handleClose : undefined,
    focusCard,
  });

  const markReady = useCallback((charId: string): void => {
    setReady((prev) => {
      if (prev.has(charId)) return prev;
      const next = new Set(prev);
      next.add(charId);
      return next;
    });
  }, []);

  const slots = useMemo(
    () =>
      // The golden option stays hidden (no preview) until it is earned.
      PICKER_IDS.filter((id) => id !== GOLDEN || goldUnlocked).map(
        (charId) => ({
          charId,
          track: previewRefs[charId],
          model: models[charId === GOLDEN ? GOLDEN_BASE : charId] ?? null,
          active: hovered === charId || focused === charId,
          ...(charId === GOLDEN ? { golden: true } : {}),
        })
      ),
    [previewRefs, hovered, focused, models, goldUnlocked]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir={rtl ? "rtl" : "ltr"}
      aria-labelledby="char-picker-title"
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm duration-200 select-none motion-reduce:animate-none sm:p-4"
    >
      <div
        ref={dialogRef}
        style={{ boxShadow: PIXEL_FRAME }}
        className="bg-background relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col rounded-none shadow-2xl"
      >
        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            aria-label={dict.play.dialogueClose}
            style={{ boxShadow: PIXEL_BTN }}
            className="focus-ring bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground absolute end-4 top-4 z-10 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-none transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="px-5 pt-5 pb-4 text-center sm:px-6 sm:pt-6">
          <h2
            id="char-picker-title"
            className="text-foreground text-lg font-bold tracking-tight sm:text-2xl"
          >
            {dict.play.chooseCharacter}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {dict.play.pickerSubtitle}
          </p>
        </div>

        {/* The shared canvas is clipped to this scroll area, so cards scrolled out of it are cut. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-6"
          >
            <div
              role="radiogroup"
              aria-label={dict.play.chooseCharacter}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
            >
              {PICKER_IDS.map((charId, index) => {
                const isSelected = highlighted === charId;
                const isGolden = charId === GOLDEN;
                const isLocked = isGolden && !goldUnlocked;
                const name = isGolden
                  ? dict.play.meta.pickerGolden
                  : (dict.play.charNames[charId] ?? `#${index + 1}`);
                const loaded = manifestReady && ready.has(charId);
                return (
                  <button
                    key={charId}
                    ref={(el) => {
                      if (el) cardRefs.current[charId] = el;
                      else delete cardRefs.current[charId];
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={isLocked || undefined}
                    aria-describedby={
                      isLocked ? "char-picker-gold-locked" : undefined
                    }
                    data-char-card={charId}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setHighlighted(charId)}
                    onDoubleClick={handleConfirm}
                    onPointerEnter={() => setHovered(charId)}
                    onPointerLeave={() =>
                      setHovered((h) => (h === charId ? null : h))
                    }
                    onFocus={() => setFocused(charId)}
                    onBlur={() => setFocused((f) => (f === charId ? null : f))}
                    style={{ boxShadow: isSelected ? PIXEL_SEL : PIXEL_UNSEL }}
                    className={`focus-ring relative flex cursor-pointer flex-col items-stretch rounded-none p-2 transition-[transform,background-color] duration-200 motion-reduce:transition-none ${
                      isSelected
                        ? "bg-accent/15 sm:scale-[1.03]"
                        : "bg-muted/40 hover:bg-muted/70"
                    }`}
                  >
                    <div
                      className="relative aspect-[5/6] w-full overflow-hidden"
                      style={{ backgroundImage: CARD_SKY }}
                    >
                      <div
                        aria-hidden
                        className="absolute inset-x-[18%] bottom-[5%] h-[9%]"
                        style={{ backgroundImage: FOOT_SHADOW }}
                      />
                      {/* The shared canvas draws this character over this box. */}
                      <div
                        ref={previewRefs[charId]}
                        aria-hidden
                        className="absolute inset-0"
                      />
                      {!loaded && !isLocked && (
                        <div
                          aria-hidden
                          className="picker-shimmer absolute inset-0 flex items-end justify-center pb-[8%]"
                        >
                          <div className="bg-foreground/10 h-[62%] w-[34%] rounded-t-full" />
                        </div>
                      )}
                    </div>

                    {isLocked && (
                      <div className="absolute inset-2 bottom-8 z-[2] flex flex-col items-center justify-center gap-1 bg-[#261f18]/80 text-center text-[#f3e2b3]">
                        <Lock aria-hidden className="h-6 w-6" />
                        <span className="text-xs font-semibold">
                          {dict.play.meta.pickerLocked}
                        </span>
                        <span
                          id="char-picker-gold-locked"
                          className="px-2 text-[10px] leading-tight opacity-90"
                        >
                          {dict.play.meta.pickerLockedHint}
                        </span>
                      </div>
                    )}

                    {isSelected && !isLocked && (
                      <div className="bg-accent text-accent-foreground absolute end-1.5 top-1.5 z-[2] flex h-5 w-5 items-center justify-center rounded-none">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}

                    <span className="text-foreground mt-2 text-center text-xs font-semibold tracking-wide sm:text-sm">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {manifestReady && (
            <PreviewCanvas
              slots={slots}
              reducedMotion={reducedMotion}
              scroller={scrollerRef}
              onReady={markReady}
            />
          )}
        </div>

        <div className="px-4 pt-3 pb-4 sm:px-6 sm:pb-6">
          <div
            role="radiogroup"
            aria-label={dict.play.meta.carPaint}
            className="mb-3 flex items-center justify-center gap-2 text-xs"
          >
            <span className="text-muted-foreground">
              {dict.play.meta.carPaint}
            </span>
            {(["standard", "gold"] as const).map((paint) => {
              const on =
                paint === "gold"
                  ? goldUnlocked && meta.progress.settings.goldCar
                  : !(goldUnlocked && meta.progress.settings.goldCar);
              const disabled = paint === "gold" && !goldUnlocked;
              return (
                <button
                  key={paint}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  title={disabled ? dict.play.meta.goldLocked : undefined}
                  onClick={() => setSetting("goldCar", paint === "gold")}
                  style={{ boxShadow: on ? PIXEL_SEL : PIXEL_UNSEL }}
                  className={`focus-ring inline-flex cursor-pointer items-center gap-1 rounded-none px-2.5 py-1 font-semibold disabled:cursor-default disabled:opacity-50 ${on ? "bg-accent/15" : "bg-muted/40"}`}
                >
                  {disabled && <Lock aria-hidden className="h-3 w-3" />}
                  {paint === "gold"
                    ? dict.play.meta.paintGold
                    : dict.play.meta.paintStandard}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={locked}
            style={{ boxShadow: PIXEL_CONFIRM }}
            className="focus-ring bg-accent text-accent-foreground w-full cursor-pointer rounded-none px-4 py-3 text-center text-sm font-semibold tracking-wide transition-opacity hover:opacity-90 active:translate-y-0.5 disabled:cursor-default disabled:opacity-50"
          >
            {dict.play.startExploring}
          </button>
        </div>
      </div>

      <style>{`
        .picker-shimmer {
          background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.18) 50%, transparent 80%);
          background-size: 220% 100%;
          animation: picker-shimmer 1.3s linear infinite;
        }
        @keyframes picker-shimmer {
          from { background-position: 120% 0; }
          to { background-position: -120% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .picker-shimmer { animation: none; }
        }
      `}</style>
    </div>
  );
}
