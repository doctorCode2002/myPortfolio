"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

function subscribeToReducedMotion(callback: () => void): () => void {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

const ReducedMotionContext = createContext<boolean>(false);

export function useReducedMotion(): boolean {
  return useContext(ReducedMotionContext);
}

export function ReducedMotionProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  return (
    <ReducedMotionContext.Provider value={prefersReducedMotion}>
      {children}
    </ReducedMotionContext.Provider>
  );
}
