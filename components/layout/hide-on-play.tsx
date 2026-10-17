"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** True on /[lang]/play and its sub-routes, where the game takes the whole screen. */
export function isPlayPath(pathname: string | null): boolean {
  return /^\/[a-z]{2}\/play(\/|$)/.test(pathname ?? "");
}

/** Renders its children everywhere except the full-screen play mode. */
export function HideOnPlay({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname();
  return isPlayPath(pathname) ? null : children;
}
