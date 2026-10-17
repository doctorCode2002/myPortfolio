import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { GalleryClient } from "./gallery-client";

/**
 * DEV-ONLY asset gallery: every model in public/game3d/models/manifest.json on a turntable grid, at its manifest
 * scale, next to a 1-hex outline and a person-height marker, so scale consistency and the no-cross rule can be
 * checked by eye. Production builds render the 404 page (and the client code is dead-code-eliminated).
 */
export const metadata: Metadata = {
  title: "3D asset gallery (dev)",
  robots: { index: false, follow: false },
};

export default function GalleryPage(): ReactNode {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main
      id="main-content"
      className="fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-[#1d2330]"
    >
      <GalleryClient />
    </main>
  );
}
