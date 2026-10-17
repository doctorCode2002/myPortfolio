import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PortraitsClient } from "./portraits-client";

/**
 * DEV-ONLY portrait generator for the "Change character" button: renders each picker
 * character's head and shoulders on a transparent 128x128 canvas (64 CSS px at 2x) and offers
 * the PNGs for download; `node scripts/3d/portraits.mjs` reads them headlessly into
 * public/game3d/portraits/. Production builds render the 404 page.
 */
export const metadata: Metadata = {
  title: "Character portraits (dev)",
  robots: { index: false, follow: false },
};

export default function PortraitsPage(): ReactNode {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main
      id="main-content"
      className="fixed inset-0 z-50 h-dvh w-screen overflow-auto bg-[#1d2330]"
    >
      <PortraitsClient />
    </main>
  );
}
