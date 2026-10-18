import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readManifestFromDisk, MODELS_DIR } from "./manifest3d.node";

// Model URLs carry ?v=<hash> and /game3d/models/*.glb is served as immutable (next.config.ts),
// so a stale hash would pin visitors to an old model for a year. Run `npm run models:hash`.
describe("model content hashes", () => {
  const manifest = readManifestFromDisk();

  it("every model with a file has a hash matching its content", () => {
    const stale: string[] = [];
    for (const [name, model] of Object.entries(manifest.models)) {
      const file = path.join(MODELS_DIR, model.file);
      if (!fs.existsSync(file)) continue;
      const hash = createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex")
        .slice(0, 10);
      if (model.hash !== hash) stale.push(name);
    }
    expect(stale, "run `npm run models:hash`").toEqual([]);
  });
});
