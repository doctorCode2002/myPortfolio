"use client";

/**
 * While gliding: a small controls hint and, on touch screens, a "Land" button (it only
 * lands over ground, like Space / E). After a soft respawn, a brief white whoosh flash
 * (a plain fade with reduced motion).
 */

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

import { subscribeMove, type Runtime } from "../runtime";

export function GlideHud({
  rtRef,
  hint,
  landLabel,
  touch,
  rtl,
}: {
  rtRef: RefObject<Runtime>;
  hint: string;
  landLabel: string;
  touch: boolean;
  rtl: boolean;
}): ReactNode {
  const subscribe = (cb: () => void): (() => void) =>
    subscribeMove(rtRef.current, cb);
  const mode = useSyncExternalStore(
    subscribe,
    () => rtRef.current.move.mode,
    () => "walk"
  );
  const whoosh = useSyncExternalStore(
    subscribe,
    () => rtRef.current.move.whoosh,
    () => 0
  );
  const flash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = flash.current;
    if (!el || whoosh === 0) return;
    const reduced = rtRef.current.reducedMotion;
    const anim = el.animate(
      reduced
        ? [{ opacity: 0.5 }, { opacity: 0 }]
        : [
            { opacity: 0, transform: "scale(1.15)" },
            { opacity: 0.85, transform: "scale(1)", offset: 0.25 },
            { opacity: 0, transform: "scale(1)" },
          ],
      { duration: reduced ? 250 : 750, easing: "ease-out" }
    );
    return () => anim.cancel();
  }, [whoosh, rtRef]);

  return (
    <>
      <div
        ref={flash}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-40 opacity-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(235,244,255,0.8) 45%, rgba(220,236,255,0) 85%)",
        }}
      />
      {mode === "glide" ? (
        <div
          dir={rtl ? "rtl" : "ltr"}
          data-game3d-glide-hud
          className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex flex-col items-center gap-2 px-4"
        >
          {touch && (
            <button
              type="button"
              onClick={() => {
                rtRef.current.move.cancel = true;
              }}
              className="border-foreground/15 bg-background/90 text-foreground pointer-events-auto rounded-full border px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md"
              data-game3d-glide-land
            >
              {landLabel}
            </button>
          )}
          <span className="bg-background/75 text-muted-foreground rounded-full px-3 py-1 text-center text-[11px] shadow backdrop-blur-sm sm:text-xs">
            {hint}
          </span>
        </div>
      ) : null}
    </>
  );
}
