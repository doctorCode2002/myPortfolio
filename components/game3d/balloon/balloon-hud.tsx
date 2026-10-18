"use client";

/**
 * The balloon's HUD (outside the canvas): the boarding chooser (scenic tour or free
 * flight; keyboard, mouse and touch, focus kept inside, Esc closes), the island names as
 * the tour passes them, a controls hint, the Up / Down / Land buttons (Up and Down only
 * on touch screens, held), Leave for the tour, and short "can't land here" hints.
 */

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

import { gameEvents } from "@/components/game/engine/events";
import { subscribeMove, type Runtime } from "../runtime";
import {
  balloonRequests,
  getBalloonUi,
  getServerBalloonUi,
  setBalloonUi,
  subscribeBalloonUi,
} from "./balloon-store";

export type BalloonHudLabels = {
  chooserTitle: string;
  tour: string;
  tourDesc: string;
  free: string;
  freeDesc: string;
  cancel: string;
  tourHint: string;
  tourTouchHint: string;
  freeHint: string;
  freeTouchHint: string;
  up: string;
  down: string;
  land: string;
  leave: string;
  lower: string;
  noRoom: string;
  landing: string;
  /** Localised island names by id. */
  islands: Record<string, string>;
};

const HINT_MS = 2200;

function choose(kind: "tour" | "free" | null): void {
  balloonRequests.start = kind;
  setBalloonUi({ chooser: false });
  gameEvents.unlockUi("balloon");
}

function Chooser({
  labels,
  rtl,
}: {
  labels: BalloonHudLabels;
  rtl: boolean;
}): ReactNode {
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === "Escape") {
        e.preventDefault();
        choose(null);
      } else if (e.key === "1") choose("tour");
      else if (e.key === "2") choose("free");
      else if (e.key === "Tab" && box.current) {
        // Keep focus inside the panel.
        const els = box.current.querySelectorAll<HTMLButtonElement>("button");
        const a = els[0];
        const b = els[els.length - 1];
        if (!a || !b) return;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const option =
    "focus-ring border-foreground/15 bg-background/95 hover:bg-muted flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-start shadow-sm";
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/20 px-4 backdrop-blur-[2px]">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="balloon-chooser-title"
        dir={rtl ? "rtl" : "ltr"}
        data-game3d-balloon-chooser
        className="border-foreground/15 bg-background/90 text-foreground flex w-full max-w-xs flex-col gap-2 rounded-2xl border p-4 shadow-xl backdrop-blur-md"
      >
        <h2
          id="balloon-chooser-title"
          className="font-serif text-base font-bold"
        >
          {labels.chooserTitle}
        </h2>
        <button
          ref={first}
          type="button"
          className={option}
          onClick={() => choose("tour")}
          data-balloon-choice="tour"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <kbd className="bg-accent text-background rounded px-1.5 font-mono text-[10px]">
              1
            </kbd>
            {labels.tour}
          </span>
          <span className="text-muted-foreground text-xs">
            {labels.tourDesc}
          </span>
        </button>
        <button
          type="button"
          className={option}
          onClick={() => choose("free")}
          data-balloon-choice="free"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <kbd className="bg-accent text-background rounded px-1.5 font-mono text-[10px]">
              2
            </kbd>
            {labels.free}
          </span>
          <span className="text-muted-foreground text-xs">
            {labels.freeDesc}
          </span>
        </button>
        <button
          type="button"
          onClick={() => choose(null)}
          className="focus-ring text-muted-foreground hover:text-foreground cursor-pointer self-center rounded-full px-3 py-1 text-xs"
        >
          {labels.cancel}
        </button>
      </div>
    </div>
  );
}

/** A button held down (pointer or touch) sets a flag until released. */
function HoldButton({
  label,
  flag,
}: {
  label: string;
  flag: "up" | "down";
}): ReactNode {
  const release = (): void => {
    balloonRequests[flag] = false;
  };
  useEffect(() => release, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        balloonRequests[flag] = true;
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      className="border-foreground/15 bg-background/90 text-foreground pointer-events-auto h-12 min-w-14 touch-none rounded-full border px-4 text-sm font-semibold shadow-lg backdrop-blur-md select-none"
      data-balloon-hold={flag}
    >
      {label}
    </button>
  );
}

export function BalloonHud({
  rtRef,
  labels,
  touch,
  rtl,
}: {
  rtRef: RefObject<Runtime>;
  labels: BalloonHudLabels;
  touch: boolean;
  rtl: boolean;
}): ReactNode {
  const ui = useSyncExternalStore(
    subscribeBalloonUi,
    getBalloonUi,
    getServerBalloonUi
  );
  const mode = useSyncExternalStore(
    (cb) => subscribeMove(rtRef.current, cb),
    () => rtRef.current.move.mode,
    () => "walk" as const
  );
  // A hint shows until its timer marks it seen.
  const [seenHint, setSeenHint] = useState(0);
  useEffect(() => {
    if (ui.hintSeq === 0) return;
    const t = setTimeout(() => setSeenHint(ui.hintSeq), HINT_MS);
    return () => clearTimeout(t);
  }, [ui.hintSeq]);
  const hint =
    ui.hint && ui.hintSeq !== seenHint
      ? ui.hint === "lower"
        ? labels.lower
        : labels.noRoom
      : null;
  const shownLabel = ui.label ?? ui.lastLabel;

  const flying = mode === "balloon";
  const phase = ui.phase;
  const action = (e: { currentTarget: HTMLButtonElement }): void => {
    // Space is the burner: don't leave the focus on a button it would press.
    e.currentTarget.blur();
    balloonRequests.action = true;
  };
  const pill =
    "border-foreground/15 bg-background/90 text-foreground pointer-events-auto rounded-full border px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md cursor-pointer";

  return (
    <>
      {ui.chooser ? <Chooser labels={labels} rtl={rtl} /> : null}
      {flying ? (
        <>
          <div
            aria-live="polite"
            dir={rtl ? "rtl" : "ltr"}
            className="pointer-events-none absolute inset-x-0 top-24 z-30 flex justify-center px-4 sm:top-20"
          >
            <span
              data-balloon-island={ui.label ?? ""}
              className="font-serif text-2xl font-bold text-white transition-opacity duration-1000 sm:text-3xl"
              style={{
                opacity: ui.label ? 0.92 : 0,
                textShadow: "0 2px 12px rgba(40,24,10,0.55)",
              }}
            >
              {shownLabel ? (labels.islands[shownLabel] ?? shownLabel) : ""}
            </span>
          </div>
          <div
            dir={rtl ? "rtl" : "ltr"}
            data-game3d-balloon-hud={phase}
            className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex flex-col items-center gap-2 px-4"
          >
            {hint ? (
              <span
                role="status"
                className="bg-background/90 text-foreground rounded-full px-3 py-1 text-xs font-medium shadow"
              >
                {hint}
              </span>
            ) : null}
            <div className="flex items-center gap-2">
              {phase === "free" && touch ? (
                <>
                  <HoldButton label={labels.up} flag="up" />
                  <HoldButton label={labels.down} flag="down" />
                </>
              ) : null}
              {phase === "free" ? (
                <button
                  type="button"
                  onClick={action}
                  className={pill}
                  data-balloon-land
                >
                  {labels.land}
                </button>
              ) : null}
              {phase === "tour" ? (
                <button
                  type="button"
                  onClick={action}
                  className={pill}
                  data-balloon-leave
                >
                  {labels.leave}
                </button>
              ) : null}
            </div>
            <span className="bg-background/75 text-muted-foreground rounded-full px-3 py-1 text-center text-[11px] shadow backdrop-blur-sm sm:text-xs">
              {phase === "auto"
                ? labels.landing
                : phase === "tour"
                  ? touch
                    ? labels.tourTouchHint
                    : labels.tourHint
                  : touch
                    ? labels.freeTouchHint
                    : labels.freeHint}
            </span>
          </div>
        </>
      ) : null}
    </>
  );
}
