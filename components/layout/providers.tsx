"use client";

import type { ReactNode } from "react";

import { SmoothScroll } from "@/components/layout/smooth-scroll";

/** Obsidian is a single dark theme, so there is no theme provider. */
export function Providers({ children }: { children: ReactNode }): ReactNode {
  return <SmoothScroll>{children}</SmoothScroll>;
}
