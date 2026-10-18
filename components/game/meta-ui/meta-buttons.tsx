"use client";

import { BookOpen, Camera } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { gameEvents } from "@/components/game/engine/events";
import {
  getMetaSnapshot,
  getServerMetaSnapshot,
  setPassportOpen,
  setPhoto,
  subscribeMeta,
} from "@/components/game3d/meta/store";
import { SHARDS } from "@/lib/content/collectibles";

const BUTTON =
  "focus-ring border-foreground/15 bg-background/85 text-foreground hover:border-accent/40 hover:bg-background inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-colors duration-200 sm:text-sm";

/** True while photo mode hides the HUD (the top-left stack reads it). */
export function usePhotoMode(): boolean {
  return useSyncExternalStore(
    subscribeMeta,
    () => getMetaSnapshot().ui.photo,
    () => false
  );
}

/** Passport (P) and photo mode (C) buttons for the top-left control stack. */
export function MetaButtons({ dict }: { dict: Dictionary }): ReactNode {
  const t = dict.play.meta;
  const snap = useSyncExternalStore(
    subscribeMeta,
    getMetaSnapshot,
    getServerMetaSnapshot
  );
  const found = snap.progress.shards.length;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (!gameEvents.isUiLocked()) setPassportOpen(true);
        }}
        aria-label={`${t.passportHint}, ${t.shards} ${found}/${SHARDS.length}`}
        title={t.passportHint}
        aria-haspopup="dialog"
        data-meta-passport
        className={BUTTON}
      >
        <BookOpen className="h-4 w-4" aria-hidden />
        <span>{t.passport}</span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {found}/{SHARDS.length}
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (!gameEvents.isUiLocked()) setPhoto(true);
        }}
        aria-label={t.photoHint}
        title={t.photoHint}
        data-meta-photo
        className={BUTTON}
      >
        <Camera className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{t.photo}</span>
      </button>
    </div>
  );
}
