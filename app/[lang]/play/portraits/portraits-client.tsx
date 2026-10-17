"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// The production check is a compile-time constant, so the generator never reaches a production bundle.
const PortraitStudio =
  process.env.NODE_ENV !== "production"
    ? dynamic(
        () =>
          import("@/components/game/picker3d/portrait-studio").then(
            (m) => m.PortraitStudio
          ),
        {
          ssr: false,
          loading: () => (
            <p className="p-6 font-mono text-sm text-white/70">Loading…</p>
          ),
        }
      )
    : null;

export function PortraitsClient(): ReactNode {
  return PortraitStudio ? <PortraitStudio /> : null;
}
