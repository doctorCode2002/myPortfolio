"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { gameEvents } from "@/components/game/engine/events";
import type { GameWorld } from "@/components/game3d/logic/world-layout";
import {
  getMetaSnapshot,
  getServerMetaSnapshot,
  liveUi,
  setMinimapOpen,
  setPassportOpen,
  setPhoto,
  subscribeMeta,
} from "@/components/game3d/meta/store";
import {
  subscribeDriving,
  subscribeMove,
  type Runtime,
} from "@/components/game3d/runtime";
import { Compass } from "./compass";
import { Minimap } from "./minimap";
import { Passport } from "./passport";
import { PhotoOverlay } from "./photo-overlay";
import { fmt, islandName } from "./strings";
import { Toasts } from "./toasts";

function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return Boolean(
    t && (/input|textarea|select/i.test(t.tagName) || t.isContentEditable)
  );
}

/** The meta overlays that only open from the HUD (passport, photo mode). */
const OWN_LOCKS = new Set(["passport", "photo", "travel"]);

/**
 * The exploration HUD over the 3D world: minimap, compass, unlock toasts, the passport,
 * photo mode and the fast-travel fade. P opens the passport, C photo mode.
 */
export function MetaHud({
  rtRef,
  world,
  dict,
  touch,
  rtl,
}: {
  rtRef: RefObject<Runtime>;
  world: GameWorld;
  dict: Dictionary;
  touch: boolean;
  rtl: boolean;
}): ReactNode {
  const snap = useSyncExternalStore(
    subscribeMeta,
    getMetaSnapshot,
    getServerMetaSnapshot
  );
  const driving = useSyncExternalStore(
    (cb) => subscribeDriving(rtRef.current, cb),
    () => rtRef.current.car.driving,
    () => false
  );
  // Gliding, riding or ballooning: no fast travel until back on foot.
  const flying = useSyncExternalStore(
    (cb) => subscribeMove(rtRef.current, cb),
    () => {
      const m = rtRef.current.move.mode;
      return m !== "walk" && m !== "drive";
    },
    () => false
  );
  const { progress, ui, toasts } = snap;
  const t = dict.play.meta;

  // Phones start with the minimap folded away.
  useEffect(() => {
    if (touch) setMinimapOpen(false);
  }, [touch]);

  // Keys: P passport, C photo mode, Esc leaves photo mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const u = liveUi();
      // Another overlay (dialogue, building panel, picker) has the floor.
      const othersOpen = gameEvents.isUiLocked() && !u.passportOpen && !u.photo;
      if (e.code === "KeyP" && !u.photo && !othersOpen) {
        if (u.travel.phase !== "idle") return;
        e.preventDefault();
        setPassportOpen(!u.passportOpen);
      } else if (e.code === "KeyC" && !u.passportOpen && !othersOpen) {
        if (u.travel.phase !== "idle") return;
        e.preventDefault();
        setPhoto(!u.photo);
      } else if (e.key === "Escape" && u.photo) {
        e.preventDefault();
        setPhoto(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close our overlays if the world unmounts.
  useEffect(
    () => () => {
      setPassportOpen(false);
      setPhoto(false);
      for (const l of OWN_LOCKS) gameEvents.unlockUi(l);
    },
    []
  );

  const travel = ui.travel;
  const veil = travel.phase === "out" ? 1 : 0;

  return (
    <div data-meta-hud className="pointer-events-none absolute inset-0 z-40">
      {!ui.photo && (
        <>
          <div
            className={`absolute ${touch ? "end-3 top-3" : "top-4 left-1/2 -translate-x-1/2 sm:top-6"}`}
          >
            <Compass
              rtRef={rtRef}
              world={world}
              dict={dict}
              progress={progress}
              target={ui.target}
              rtl={rtl}
            />
          </div>
          <div
            className={`absolute ${touch ? "end-3 bottom-20" : "start-4 bottom-4 sm:start-6 sm:bottom-6"}`}
          >
            <Minimap
              rtRef={rtRef}
              world={world}
              dict={dict}
              progress={progress}
              ui={ui}
              touch={touch}
              rtl={rtl}
              driving={driving}
              flying={flying}
            />
          </div>
          <div className="absolute end-4 top-16 sm:end-6 sm:top-20">
            <Toasts toasts={toasts} dict={dict} rtl={rtl} />
          </div>
        </>
      )}
      {ui.passportOpen &&
        createPortal(
          <Passport dict={dict} progress={progress} rtl={rtl} />,
          document.body
        )}
      {ui.photo && (
        <div className="pointer-events-auto">
          <PhotoOverlay
            rtRef={rtRef}
            dict={dict}
            filter={ui.photoFilter}
            caption={ui.photoCaption}
            rtl={rtl}
          />
        </div>
      )}
      {createPortal(
        <div
          aria-hidden={travel.phase === "idle"}
          className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center transition-opacity duration-[420ms] ease-in-out motion-reduce:duration-150"
          style={{
            opacity: veil,
            background:
              "linear-gradient(180deg, #8fb4dc 0%, #c9b8dd 55%, #f6c39b 100%)",
          }}
        >
          <p
            className="rounded-full bg-white/40 px-4 py-1.5 text-sm font-semibold text-[#3d3326]"
            aria-live="polite"
          >
            {travel.to && travel.phase !== "idle"
              ? fmt(t.travelling, { island: islandName(dict, travel.to) })
              : ""}
          </p>
        </div>,
        document.body
      )}
    </div>
  );
}
