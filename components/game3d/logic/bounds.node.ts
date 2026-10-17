/**
 * Node-only helper for tests: model bounds read from public/game3d/models on disk, so
 * reachability tests use the same colliders as the browser (hex-edge fences on their edge).
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import type { ModelLocalBounds } from "./catalog";
import { glbBounds } from "./glb-bounds";
import type { Island3D, Manifest } from "./types";
import { modelsNeedingBounds } from "./world-layout";

export function readModelBoundsFromDisk(
  islands: readonly Island3D[],
  manifest: Manifest,
  dir = path.join(process.cwd(), "public/game3d/models")
): Record<string, ModelLocalBounds | null> {
  const out: Record<string, ModelLocalBounds | null> = {};
  for (const name of modelsNeedingBounds(islands, manifest)) {
    const file = manifest.models[name]?.file;
    if (!file) continue;
    try {
      const b = readFileSync(path.join(dir, file));
      out[name] = glbBounds(
        b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
      );
    } catch {
      out[name] = null;
    }
  }
  return out;
}
