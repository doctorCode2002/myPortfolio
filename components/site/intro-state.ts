"use client";

import { useSyncExternalStore } from "react";

/**
 * Is the intro loader out of the way? The inline head script sets
 * <html data-intro> when the loader will play; the loader removes it when it
 * finishes. Hero reveals wait on this so they play as the curtain lifts.
 */

export const INTRO_DONE_EVENT = "intro:done";

function subscribe(cb: () => void): () => void {
  window.addEventListener(INTRO_DONE_EVENT, cb);
  return () => window.removeEventListener(INTRO_DONE_EVENT, cb);
}

export function useIntroDone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !document.documentElement.hasAttribute("data-intro"),
    () => false
  );
}
