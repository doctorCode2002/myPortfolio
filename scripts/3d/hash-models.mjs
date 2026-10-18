#!/usr/bin/env node
/**
 * Writes a short content hash into every model entry of public/game3d/models/manifest.json and
 * its fragments. modelUrl() appends it as ?v=<hash>, which lets the browser cache the .glb files
 * forever (next.config.ts sets them immutable): a changed model gets a new URL.
 *
 *   node scripts/3d/hash-models.mjs          # update the hashes
 *   node scripts/3d/hash-models.mjs --check  # exit 1 if any hash is stale (CI/tests)
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "game3d", "models");
const check = process.argv.includes("--check");

export function fileHash(file) {
  return createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .slice(0, 10);
}

const base = JSON.parse(
  fs.readFileSync(path.join(DIR, "manifest.json"), "utf8")
);
const files = ["manifest.json", ...(base.fragments ?? [])];
let stale = 0;
for (const name of files) {
  const p = path.join(DIR, name);
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  let changed = false;
  for (const [key, model] of Object.entries(json.models ?? {})) {
    const f = path.join(DIR, model.file);
    if (!fs.existsSync(f)) continue;
    const h = fileHash(f);
    if (model.hash !== h) {
      stale++;
      if (check) console.error(`stale hash: ${name} ${key}`);
      model.hash = h;
      changed = true;
    }
  }
  if (changed && !check)
    fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n");
}
if (check && stale) process.exit(1);
if (!check)
  console.log(
    `hashed models in ${files.length} manifest files (${stale} updated)`
  );
