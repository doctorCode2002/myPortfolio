"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Site-wide motion preference.
 *
 * Motion is off when the visitor has chosen "Motion off" with the site toggle,
 * or — if they never chose — when the OS asks for reduced motion. The choice is
 * stored in localStorage and mirrored on <html data-motion="on|off"> by the
 * inline script in the root layout before first paint, so CSS can react with
 * no flash; components read it through these hooks.
 *
 * This is the single "pause/stop" control WCAG 2.2.2 asks for: the marquee,
 * the WebGL hero, film grain, smooth scroll and the cursor swarm all follow it.
 */

export const MOTION_STORAGE_KEY = "motion";
const EVENT = "motionchange";

function osReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readStored(): "on" | "off" | null {
  try {
    const v = localStorage.getItem(MOTION_STORAGE_KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}

function motionAllowedSnapshot(): boolean {
  const stored = readStored();
  return stored ? stored === "on" : !osReduced();
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    mq.removeEventListener("change", callback);
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** True when animations may run. Server render assumes yes. */
export function useMotionAllowed(): boolean {
  return useSyncExternalStore(subscribe, motionAllowedSnapshot, () => true);
}

/** Inverse of useMotionAllowed — kept for existing callers. */
export function useReducedMotion(): boolean {
  return !useMotionAllowed();
}

/** Non-hook check for imperative code (effects, rAF loops). */
export function isMotionAllowed(): boolean {
  if (typeof window === "undefined") return true;
  return motionAllowedSnapshot();
}

export function setMotionAllowed(allowed: boolean): void {
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, allowed ? "on" : "off");
  } catch {
    /* private mode: the toggle still works for this page view */
  }
  document.documentElement.dataset.motion = allowed ? "on" : "off";
  window.dispatchEvent(new Event(EVENT));
}

/** Subscribe imperative code to preference changes. */
export function onMotionChange(callback: () => void): () => void {
  return subscribe(callback);
}

/**
 * Kept so existing imports compile; the preference lives in an external store,
 * so no React context is needed.
 */
export function ReducedMotionProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return children;
}
