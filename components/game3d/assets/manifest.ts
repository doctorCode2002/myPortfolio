/**
 * Loading the asset manifest (public/game3d/models/manifest.json) and resolving model
 * URLs. Banned models are refused here, so no loader can ever fetch them.
 */

import type { Manifest, ManifestModel } from "../logic/types";

export const MODELS_BASE = "/game3d/models/";

export async function fetchManifest(
  signal?: AbortSignal
): Promise<Manifest | null> {
  try {
    const res = await fetch(
      `${MODELS_BASE}manifest.json`,
      signal ? { signal } : {}
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Manifest;
    return json && typeof json === "object" && json.models ? json : null;
  } catch {
    return null;
  }
}

const warned = new Set<string>();

/** The model entry when it exists and is allowed, else undefined (with a dev warning for banned ones). */
export function allowedModel(
  manifest: Manifest | null,
  name: string
): ManifestModel | undefined {
  const m = manifest?.models[name];
  if (!m) return undefined;
  if (m.banned) {
    if (process.env.NODE_ENV !== "production" && !warned.has(name)) {
      warned.add(name);
      console.warn(
        `[game3d] refusing banned model "${name}": ${m.reason ?? ""}`
      );
    }
    return undefined;
  }
  return m;
}

export function modelUrl(
  manifest: Manifest | null,
  name: string
): string | null {
  const m = allowedModel(manifest, name);
  return m ? `${MODELS_BASE}${m.file}` : null;
}
