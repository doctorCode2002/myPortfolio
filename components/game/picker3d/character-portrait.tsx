"use client";

import { useState, type ReactNode } from "react";

import { CHARACTER_COLORS } from "@/components/game3d/assets/characters";

/** Pre-rendered head-and-shoulders PNGs (see scripts/3d/portraits.mjs). */
export const PORTRAITS_BASE = "/game3d/portraits/";

/** A small static portrait of a 3D character (128x128 PNG shown at `size` CSS px). */
export function CharacterPortrait({
  charId,
  size = 24,
  className = "",
}: {
  charId: string;
  size?: number;
  className?: string;
}): ReactNode {
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === charId;
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage:
          "linear-gradient(180deg, #4a72a8 0%, #b9a7d0 55%, #f8b487 100%)",
      }}
    >
      {failed ? (
        <span
          className="block h-1/2 w-1/2 rounded-full"
          style={{ backgroundColor: CHARACTER_COLORS[charId] ?? "#d4a359" }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${PORTRAITS_BASE}${charId}.png`}
          alt=""
          width={size}
          height={size}
          draggable={false}
          onError={() => setFailedFor(charId)}
          className="block h-full w-full object-cover"
        />
      )}
    </span>
  );
}
