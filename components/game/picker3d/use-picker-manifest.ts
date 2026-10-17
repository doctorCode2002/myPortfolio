"use client";

import { useEffect, useMemo, useState } from "react";

import { playerModelFor } from "@/components/game3d/assets/characters";
import {
  allowedModel,
  fetchManifest,
  modelUrl,
} from "@/components/game3d/assets/manifest";
import type { Manifest } from "@/components/game3d/logic/types";

/** One manifest request per page (the browser cache already holds it once the world has loaded). */
let manifestPromise: Promise<Manifest | null> | null = null;

function loadManifest(): Promise<Manifest | null> {
  manifestPromise ??= fetchManifest().then((m) => {
    if (!m) manifestPromise = null; // let a later open retry
    return m;
  });
  return manifestPromise;
}

export type PreviewModel = { url: string; scale: number } | null;

/** The 3D model (url + manifest scale) behind each picker id, once the manifest is in. */
export function usePickerModels(
  charIds: readonly string[],
  enabled = true
): { ready: boolean; models: Record<string, PreviewModel> } {
  const [manifest, setManifest] = useState<Manifest | null | undefined>(
    undefined
  );

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadManifest().then((m) => {
      if (alive) setManifest(m);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  const models = useMemo(() => {
    const out: Record<string, PreviewModel> = {};
    for (const id of charIds) {
      const name = manifest ? playerModelFor(manifest, id) : null;
      const url = name ? modelUrl(manifest ?? null, name) : null;
      out[id] =
        name && url
          ? { url, scale: allowedModel(manifest ?? null, name)?.scale ?? 1 }
          : null;
    }
    return out;
  }, [charIds, manifest]);
  return { ready: manifest !== undefined, models };
}
