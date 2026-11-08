"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { INTRO_DONE_EVENT } from "./intro-state";

/** Hard ceiling on how long the intro may hold the page. */
const MAX_MS = 2200;
/** Shortest run, so it reads as intentional rather than a flash. */
const MIN_MS = 1200;

export const INTRO_SEEN_KEY = "intro-seen";

/**
 * Pending "release the page" from an unmount. Deferred one tick so React's
 * dev-mode effect double-run (mount → cleanup → mount) cancels it instead of
 * ending the intro early; a real unmount still unlocks the page.
 */
let pendingRelease: ReturnType<typeof setTimeout> | null = null;

/**
 * Inline <head> script: decide before first paint whether the intro plays
 * (first visit this session, motion allowed) and apply the motion preference.
 * Without this script nothing sets data-intro, so the overlay stays
 * display:none — the page can never be stuck behind it.
 */
export const HEAD_SCRIPT = `(function(){try{var d=document.documentElement;var m=localStorage.getItem("motion");var on=m?m==="on":!matchMedia("(prefers-reduced-motion: reduce)").matches;d.dataset.motion=on?"on":"off";if(on&&!sessionStorage.getItem("${INTRO_SEEN_KEY}")){d.setAttribute("data-intro","1")}}catch(e){}})();`;

type Labels = { label: string; status: string; skip: string };

/**
 * Intro: counter 000→100 tied to real readiness (web fonts + window load),
 * capped at ~2 s, skippable. The page underneath is fully server-rendered and
 * painted the whole time — the loader only covers it — so it never delays what
 * search engines and Core Web Vitals see.
 */
export function IntroLoader({
  labels,
  words,
  name,
}: {
  labels: Labels;
  words: readonly string[];
  name: string;
}): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => {});
  const [word, setWord] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (pendingRelease) {
      clearTimeout(pendingRelease);
      pendingRelease = null;
    }
    const html = document.documentElement;
    const root = rootRef.current;
    const counter = counterRef.current;
    const bar = barRef.current;
    if (!root || !counter || !bar || !html.hasAttribute("data-intro")) {
      setDone(true);
      return;
    }

    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      /* fine: it just plays again next time */
    }

    let cancelled = false;
    let finished = false;
    let raf = 0;
    const start = performance.now();
    let ready = false;
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((r) =>
            window.addEventListener("load", () => r(), { once: true })
          );
    void Promise.all([fonts, loaded]).then(() => {
      ready = true;
    });

    const words = window.setInterval(() => setWord((w) => w + 1), 380);

    const release = (): void => {
      html.removeAttribute("data-intro");
      window.dispatchEvent(new Event(INTRO_DONE_EVENT));
      setDone(true);
    };

    const finish = async (from: number): Promise<void> => {
      if (finished) return;
      finished = true;
      // Releasing <html data-intro> mid-curtain would display:none this via
      // CSS; pin it visible until its own exit animation completes.
      root.style.display = "flex";
      cancelAnimationFrame(raf);
      window.clearInterval(words);
      const ease = "cubic-bezier(.76,0,.24,1)";
      try {
        await bar.animate(
          [{ transform: `scaleX(${from})` }, { transform: "scaleX(1)" }],
          {
            duration: 280,
            easing: ease,
            fill: "forwards",
          }
        ).finished;
        counter.animate(
          [
            { transform: "translateY(0)", opacity: 1 },
            { transform: "translateY(-30%)", opacity: 0 },
          ],
          { duration: 500, easing: ease, fill: "forwards" }
        );
        // Let the page start revealing as the curtain lifts.
        setTimeout(() => {
          if (!cancelled) {
            html.removeAttribute("data-intro");
            window.dispatchEvent(new Event(INTRO_DONE_EVENT));
          }
        }, 380);
        await root.animate(
          [{ clipPath: "inset(0 0 0% 0)" }, { clipPath: "inset(0 0 100% 0)" }],
          {
            duration: 850,
            delay: 100,
            easing: ease,
            fill: "forwards",
          }
        ).finished;
      } catch {
        /* interrupted */
      }
      if (!cancelled) release();
    };

    let shown = 0;
    skipRef.current = () => void finish(shown / 100);

    const tick = (now: number): void => {
      if (cancelled) return;
      const elapsed = now - start;
      const goal = (ready && elapsed >= MIN_MS) || elapsed >= MAX_MS ? 100 : 88;
      shown += (goal - shown) * (goal === 100 ? 0.22 : 0.05);
      if (goal === 100 && shown > 99.4) shown = 100;
      const n = Math.floor(shown);
      counter.textContent = String(n).padStart(3, "0");
      bar.style.transform = `scaleX(${shown / 100})`;
      if (n >= 100) {
        void finish(1);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") skipRef.current();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearInterval(words);
      window.removeEventListener("keydown", onKey);
      // Never leave the page locked if this unmounts mid-run.
      pendingRelease = setTimeout(() => {
        pendingRelease = null;
        html.removeAttribute("data-intro");
        window.dispatchEvent(new Event(INTRO_DONE_EVENT));
      }, 0);
    };
  }, []);

  if (done) return null;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-label={labels.label}
      className="intro-loader bg-background text-foreground fixed inset-0 z-[9800] flex-col justify-between px-5 py-6 sm:px-10 sm:py-8"
    >
      <div className="text-muted-foreground flex items-start justify-between font-mono text-[11px] tracking-[0.22em] uppercase">
        <span className="font-display text-foreground text-2xl leading-none tracking-tight normal-case">
          M<span className="text-ember italic">a</span>
        </span>
        <button
          type="button"
          onClick={() => skipRef.current()}
          className="border-line hover:border-foreground hover:text-foreground rounded-full border px-4 py-2 transition-colors"
        >
          {labels.skip}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
          {name}
        </p>
        <p className="font-display h-[1.15em] overflow-hidden text-[clamp(2.4rem,6vw,4.5rem)] leading-none italic">
          <span
            key={word}
            className="block animate-[intro-word_380ms_cubic-bezier(.2,.7,.1,1)]"
          >
            {words[word % words.length]}
            <span className="text-ember">.</span>
          </span>
        </p>
        <style>{`@keyframes intro-word{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      </div>

      <div>
        <div className="flex items-end justify-between gap-6">
          <span className="text-muted-foreground pb-3 font-mono text-[11px] tracking-[0.22em] uppercase">
            {labels.status}
          </span>
          <span
            ref={counterRef}
            dir="ltr"
            className="font-display text-[clamp(6rem,24vw,22rem)] leading-[0.78] tracking-[-0.04em] tabular-nums"
            aria-hidden="true"
          >
            000
          </span>
        </div>
        <div className="bg-line mt-6 h-px w-full">
          <div
            ref={barRef}
            className="bg-ember h-full w-full origin-left rtl:origin-right"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      </div>
    </div>
  );
}
