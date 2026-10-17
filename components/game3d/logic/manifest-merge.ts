/**
 * Merges manifest fragments into the base manifest. Each island designer owns one fragment
 * (public/game3d/models/<name>.json listed in manifest.fragments), so their procedural models
 * never collide in the shared manifest.json. Pure: no three/react/node imports.
 */

import type { Manifest, ManifestFragment } from "./types";

export function mergeManifestFragments(
  base: Manifest,
  fragments: ReadonlyArray<{ name: string; fragment: ManifestFragment }>
): Manifest {
  const models = { ...base.models };
  for (const { name, fragment } of fragments) {
    for (const [key, model] of Object.entries(fragment.models ?? {})) {
      if (key in models) {
        throw new Error(
          `manifest fragment ${name}: model "${key}" already exists`
        );
      }
      models[key] = model;
    }
  }
  return { ...base, models };
}
