"use client";

import {
  Clock,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  setSoundEnabled,
  soundEnabled,
  subscribeSound,
} from "../audio/sound-store";
import { getTimeMode, setTimeMode, subscribeAtmosphere } from "./store";
import { nextMode, type TimeMode } from "./time-of-day";

const TIME_ICON: Record<TimeMode, LucideIcon> = {
  auto: Clock,
  dawn: Sunrise,
  day: Sun,
  sunset: Sunset,
  night: Moon,
};

const BUTTON =
  "focus-ring border-foreground/15 bg-background/85 text-foreground hover:border-accent/40 hover:bg-background inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-colors duration-200 sm:text-sm";

/**
 * The 3D world's sound toggle (muted by default, remembered) and time-of-day toggle
 * (local time, then each preset), for the top-left control stack.
 */
export function AtmosphereControls({ dict }: { dict: Dictionary }): ReactNode {
  const t = dict.play.atmosphere;
  const sound = useSyncExternalStore(subscribeSound, soundEnabled, () => false);
  const mode = useSyncExternalStore(
    subscribeAtmosphere,
    getTimeMode,
    () => "auto" as TimeMode
  );
  const Icon = TIME_ICON[mode];
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setSoundEnabled(!sound)}
        aria-pressed={sound}
        aria-label={t.soundHint}
        title={t.soundHint}
        data-game3d-sound
        className={BUTTON}
      >
        {sound ? (
          <Volume2 className="h-4 w-4" aria-hidden />
        ) : (
          <VolumeX className="h-4 w-4" aria-hidden />
        )}
        <span>{sound ? t.soundOn : t.soundOff}</span>
      </button>
      <button
        type="button"
        onClick={() => setTimeMode(nextMode(mode))}
        aria-label={`${t.timeHint}: ${t.time[mode]}`}
        title={t.timeHint}
        data-game3d-time={mode}
        className={BUTTON}
      >
        <Icon className="h-4 w-4" aria-hidden />
        <span>{t.time[mode]}</span>
      </button>
    </div>
  );
}
