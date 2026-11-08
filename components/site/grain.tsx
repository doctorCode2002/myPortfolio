"use client";

import type { ReactNode } from "react";

import Noise from "@/components/vendor/reactbits/Noise";
import { useMotionAllowed } from "@/lib/motion";

/** Fixed film grain over the whole site; still (not animated) when motion is off. */
export function Grain(): ReactNode {
  const allowed = useMotionAllowed();
  return (
    <Noise
      fixed
      opacity={0.055}
      blendMode="overlay"
      fps={allowed ? 18 : 0}
      contrast={0.6}
      zIndex={80}
    />
  );
}
