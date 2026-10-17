"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// The production check is a compile-time constant, so the 3D gallery never reaches a production bundle.
const ModelGallery =
  process.env.NODE_ENV !== "production"
    ? dynamic(() => import("./model-gallery").then((m) => m.ModelGallery), {
        ssr: false,
        loading: () => (
          <p className="p-6 font-mono text-sm text-white/70">
            Loading gallery…
          </p>
        ),
      })
    : null;

export function GalleryClient(): ReactNode {
  return ModelGallery ? <ModelGallery /> : null;
}
