"use client";

import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Flame,
  Gem,
  Lock,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { gameEvents } from "@/components/game/engine/events";
import {
  ACHIEVEMENTS,
  SMASH_GOAL,
  allShardsFound,
  type Progress,
} from "@/components/game3d/meta/progress";
import {
  RULES,
  setPassportOpen,
  setSetting,
} from "@/components/game3d/meta/store";
import {
  META_ISLANDS,
  SHARDS,
  shardsOnIsland,
} from "@/lib/content/collectibles";
import { storyForIsland } from "@/lib/content/tours";
import { fmt, islandName, type MetaDict } from "./strings";
import { useFocusTrap } from "./use-focus-trap";

/** Stamp ink per island. */
export const ISLAND_INK: Readonly<Record<string, string>> = {
  home: "#4f8f3a",
  khidmty: "#3a6fb0",
  civicmind: "#2f8c86",
  onyx: "#b0802a",
  saleh: "#c0612b",
  eyad: "#c0507f",
  workshop: "#6b6b78",
  waco: "#2a7687",
};

const PAGES = META_ISLANDS.length + 1;

function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia("(min-width: 768px)");
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  );
}

function Row({
  done,
  label,
  value,
  na,
}: {
  done: boolean;
  label: string;
  value?: string;
  /** Not applicable on this island (shown muted, no tick). */
  na?: boolean;
}): ReactNode {
  return (
    <li
      className={`flex items-center gap-2 py-1 text-sm ${na ? "text-[#8a7a62]" : "text-[#3d3326]"}`}
    >
      {na ? (
        <span aria-hidden className="h-4 w-4" />
      ) : done ? (
        <Check aria-hidden className="h-4 w-4 shrink-0 text-[#4f8f3a]" />
      ) : (
        <Circle aria-hidden className="h-4 w-4 shrink-0 text-[#b3a283]" />
      )}
      <span className="flex-1">{label}</span>
      {value ? <span className="font-mono text-xs">{value}</span> : null}
    </li>
  );
}

function IslandPage({
  id,
  progress,
  dict,
  t,
}: {
  id: string;
  progress: Progress;
  dict: Dictionary;
  t: MetaDict;
}): ReactNode {
  const visited = progress.visited.includes(id);
  const hasMayor = RULES.mayorIslands.includes(id);
  const hasTour = Boolean(storyForIsland(id));
  const shards = shardsOnIsland(id);
  const found = shards.filter((s) => progress.shards.includes(s.id)).length;
  const ink = ISLAND_INK[id] ?? "#6b6b78";
  const name = islandName(dict, id);
  return (
    <section aria-label={name} className="flex h-full flex-col gap-3">
      <h3 className="font-serif text-lg font-bold text-[#3d3326]">{name}</h3>
      <div className="flex min-h-24 items-center justify-center">
        {visited ? (
          <div
            role="img"
            aria-label={`${t.visited}: ${name}`}
            className="flex h-24 w-32 -rotate-6 flex-col items-center justify-center rounded-xl border-4 border-double px-2 text-center motion-reduce:rotate-0"
            style={{ borderColor: ink, color: ink }}
          >
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase">
              {t.visited}
            </span>
            <span className="text-sm leading-tight font-bold">{name}</span>
          </div>
        ) : (
          <div className="flex h-24 w-32 items-center justify-center rounded-xl border-2 border-dashed border-[#c9b896] px-2 text-center text-xs text-[#8a7a62]">
            {t.notVisited}
          </div>
        )}
      </div>
      <ul className="divide-y divide-[#e3d5b8]">
        <Row done={visited} label={visited ? t.visited : t.notVisited} />
        <Row
          done={progress.mayors.includes(id)}
          label={hasMayor ? t.mayor : t.noMayor}
          na={!hasMayor}
        />
        <Row
          done={progress.tours.includes(id)}
          label={hasTour ? t.tour : t.noTour}
          na={!hasTour}
        />
        <Row
          done={found === shards.length && shards.length > 0}
          label={t.shards}
          value={`${found}/${shards.length}`}
        />
        <Row done={progress.fires.includes(id)} label={t.fire} />
      </ul>
    </section>
  );
}

function AchievementsPage({
  progress,
  t,
}: {
  progress: Progress;
  t: MetaDict;
}): ReactNode {
  const unlocked = allShardsFound(progress);
  return (
    <section
      aria-label={t.achievementsTitle}
      className="flex h-full flex-col gap-3"
    >
      <h3 className="font-serif text-lg font-bold text-[#3d3326]">
        {t.achievementsTitle}
      </h3>
      <ul className="grid gap-1.5">
        {ACHIEVEMENTS.map((a) => {
          const got = progress.achievements.includes(a);
          const info = t.achievements[a];
          return (
            <li
              key={a}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 ${got ? "bg-[#f3e2b3]" : ""}`}
            >
              {got ? (
                <Award
                  aria-hidden
                  className="h-5 w-5 shrink-0 text-[#b0802a]"
                />
              ) : (
                <Lock aria-hidden className="h-4 w-4 shrink-0 text-[#b3a283]" />
              )}
              <span className="flex min-w-0 flex-col leading-tight">
                <span
                  className={`text-sm font-semibold ${got ? "text-[#3d3326]" : "text-[#8a7a62]"}`}
                >
                  {info.name}
                  <span className="sr-only"> ({got ? t.done : t.notYet})</span>
                </span>
                <span className="text-xs text-[#6d5f4a]">
                  {a === "smash50"
                    ? fmt(t.smashCount, {
                        n: Math.min(progress.smashed, SMASH_GOAL),
                        goal: SMASH_GOAL,
                      })
                    : info.desc}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <h3 className="mt-1 font-serif text-base font-bold text-[#3d3326]">
        {t.settingsTitle}
      </h3>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[#3d3326]">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#b0802a]"
          checked={progress.settings.compassShards}
          onChange={(e) => setSetting("compassShards", e.target.checked)}
        />
        <Gem aria-hidden className="h-4 w-4 text-[#2f8c86]" />
        {t.compassShards}
      </label>
      <label
        className={`flex items-center gap-2 text-sm ${unlocked ? "cursor-pointer text-[#3d3326]" : "text-[#8a7a62]"}`}
      >
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#b0802a]"
          disabled={!unlocked}
          checked={unlocked && progress.settings.goldCar}
          onChange={(e) => setSetting("goldCar", e.target.checked)}
          aria-describedby={unlocked ? undefined : "passport-gold-locked"}
        />
        {unlocked ? (
          <Flame aria-hidden className="h-4 w-4 text-[#b0802a]" />
        ) : (
          <Lock aria-hidden className="h-4 w-4" />
        )}
        {t.goldCar}
      </label>
      {!unlocked && (
        <p id="passport-gold-locked" className="text-xs text-[#8a7a62]">
          {t.goldLocked}
        </p>
      )}
    </section>
  );
}

/**
 * The sky passport: a book with a page per island (visit stamp, mayor, tour, shards, signal
 * fire) and an achievements page with the settings. Two pages per spread on wide screens.
 * Focus is trapped inside; Esc or P closes; the arrow keys turn pages (mirrored in RTL).
 */
export function Passport({
  dict,
  progress,
  rtl,
}: {
  dict: Dictionary;
  progress: Progress;
  rtl: boolean;
}): ReactNode {
  const t = dict.play.meta;
  const wide = useWide();
  const step = wide ? 2 : 1;
  const [page, setPage] = useState(0);
  const first = page - (page % step);
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(ref, true, closeRef);

  useEffect(() => {
    gameEvents.lockUi("passport");
    return () => gameEvents.unlockUi("passport");
  }, []);

  const close = useCallback(() => setPassportOpen(false), []);
  const turn = useCallback(
    (dir: 1 | -1) =>
      setPage((p) => {
        const base = p - (p % step);
        return Math.max(0, Math.min(PAGES - 1, base + dir * step));
      }),
    [step]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" || (e.code === "KeyP" && !e.repeat)) {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const t = e.target as HTMLElement | null;
        if (t?.tagName === "INPUT") return;
        e.preventDefault();
        const forward = (e.key === "ArrowRight") !== rtl;
        turn(forward ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, turn, rtl]);

  const pages = [first, first + 1].slice(0, step).filter((p) => p < PAGES);
  const renderPage = (p: number): ReactNode =>
    p < META_ISLANDS.length ? (
      <IslandPage
        id={META_ISLANDS[p] as string}
        progress={progress}
        dict={dict}
        t={t}
      />
    ) : (
      <AchievementsPage progress={progress} t={t} />
    );
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  const shardTotal = progress.shards.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="passport-title"
        dir={rtl ? "rtl" : "ltr"}
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-4 border-[#5a3d26] bg-[#5a3d26] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-[#f3e2b3]">
          <h2
            id="passport-title"
            className="font-serif text-base font-bold tracking-wide"
          >
            {t.passportTitle}
            <span className="ms-2 font-sans text-xs font-normal opacity-80">
              <Gem aria-hidden className="me-1 inline h-3.5 w-3.5" />
              {shardTotal}/{SHARDS.length}
            </span>
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="focus-ring cursor-pointer rounded-full border border-[#f3e2b3]/40 px-3 py-1 text-xs font-semibold hover:bg-[#f3e2b3]/10"
          >
            {t.close}
          </button>
        </div>
        <div
          className={`relative grid min-h-0 flex-1 overflow-y-auto bg-[#fbf3df] ${wide ? "grid-cols-2" : "grid-cols-1"}`}
          aria-live="polite"
        >
          {pages.map((p, i) => (
            <div
              key={p}
              className={`p-5 sm:p-6 ${wide && i === 0 ? "border-e border-[#e3d5b8] shadow-[inset_-18px_0_24px_-22px_rgba(90,61,38,0.6)] rtl:shadow-[inset_18px_0_24px_-22px_rgba(90,61,38,0.6)]" : ""}`}
            >
              {renderPage(p)}
              <p className="mt-3 text-center text-[11px] text-[#8a7a62]">
                {fmt(t.page, { n: p + 1, total: PAGES })}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 bg-[#5a3d26] px-3 py-2">
          <button
            type="button"
            onClick={() => turn(-1)}
            disabled={first === 0}
            aria-label={t.prevPage}
            className="focus-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#f3e2b3] hover:bg-[#f3e2b3]/10 disabled:cursor-default disabled:opacity-30"
          >
            <Prev aria-hidden className="h-5 w-5" />
          </button>
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: Math.ceil(PAGES / step) }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === Math.floor(first / step) ? "bg-[#f3e2b3]" : "bg-[#f3e2b3]/30"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => turn(1)}
            disabled={first + step >= PAGES}
            aria-label={t.nextPage}
            className="focus-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#f3e2b3] hover:bg-[#f3e2b3]/10 disabled:cursor-default disabled:opacity-30"
          >
            <Next aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
