"use client";

import { Users } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  getServerSocialPrefs,
  getSocialPrefs,
  setSocialPrefs,
  subscribeSocialPrefs,
} from "@/lib/social/prefs";

const BUTTON =
  "focus-ring border-foreground/15 bg-background/85 text-foreground hover:border-accent/40 hover:bg-background inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-colors duration-200 sm:text-sm";

/**
 * "Visitors" pill for the top-left stack: a small popover with "Show other visitors"
 * and "Share my position" (both on by default, remembered).
 */
export function SocialControls({ dict }: { dict: Dictionary }): ReactNode {
  const t = dict.play.social;
  const prefs = useSyncExternalStore(
    subscribeSocialPrefs,
    getSocialPrefs,
    getServerSocialPrefs
  );
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = prefs.show || prefs.share;
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        title={t.settingsHint}
        className={BUTTON}
        data-social-toggle
      >
        <Users
          className={`h-4 w-4 ${active ? "" : "opacity-40"}`}
          aria-hidden
        />
        <span>{t.visitors}</span>
      </button>
      {open && (
        <div
          id={`${id}-menu`}
          className="border-foreground/15 bg-background/95 absolute start-0 top-full z-50 mt-2 flex w-64 flex-col gap-2 rounded-xl border p-3 text-xs shadow-lg backdrop-blur-md"
        >
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={prefs.show}
              onChange={(e) => setSocialPrefs({ show: e.target.checked })}
              className="accent-accent h-4 w-4"
              data-social-pref="show"
            />
            <span>{t.showOthers}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={prefs.share}
              onChange={(e) => setSocialPrefs({ share: e.target.checked })}
              className="accent-accent h-4 w-4"
              data-social-pref="share"
            />
            <span>{t.shareMine}</span>
          </label>
          <p className="text-muted-foreground text-[11px] leading-snug">
            {t.presenceNote}
          </p>
        </div>
      )}
    </div>
  );
}
