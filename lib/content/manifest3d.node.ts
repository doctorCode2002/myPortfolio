/**
 * Node-only: reads public/game3d/models/manifest.json plus its fragments from disk, merged the
 * same way the browser does. For vitest and scripts; never import it from client code.
 */

import fs from "node:fs";
import path from "node:path";
import { mergeManifestFragments } from "@/components/game3d/logic/manifest-merge";
import type {
  Manifest,
  ManifestFragment,
} from "@/components/game3d/logic/types";

export const MODELS_DIR = path.join(
  process.cwd(),
  "public",
  "game3d",
  "models"
);

export function readManifestFromDisk(dir: string = MODELS_DIR): Manifest {
  const read = <T>(file: string): T =>
    JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as T;
  const base = read<Manifest>("manifest.json");
  const fragments = (base.fragments ?? []).map((name) => ({
    name,
    fragment: read<ManifestFragment>(name),
  }));
  return mergeManifestFragments(base, fragments);
}
