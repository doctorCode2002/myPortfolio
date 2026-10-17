import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isModelKind, type ModelManifest } from "./manifest3d";

const MODELS_DIR = path.resolve(
  import.meta.dirname,
  "../../public/game3d/models"
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(MODELS_DIR, "manifest.json"), "utf8")
) as ModelManifest;
const entries = Object.entries(manifest.models);

describe("3D model manifest", () => {
  it("has the world-unit header", () => {
    expect(manifest.version).toBe(1);
    expect(manifest.unit).toBe("metre");
    expect(manifest.hexSize).toBeGreaterThan(0);
    expect(manifest.characterHeight).toBeCloseTo(0.45 * manifest.hexSize, 2);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("points every model at an existing glb named after it", () => {
    for (const [name, m] of entries) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(m.file).toBe(`${name}.glb`);
      const file = path.join(MODELS_DIR, m.file);
      expect(fs.existsSync(file), m.file).toBe(true);
      expect(fs.statSync(file).size, `${m.file} bytes`).toBe(m.bytes);
    }
  });

  it("uses only valid kinds, CC0 licences and sane measurements", () => {
    for (const [name, m] of entries) {
      expect(isModelKind(m.kind), `${name} kind ${m.kind}`).toBe(true);
      expect(m.license, name).toBe("CC0");
      expect(m.scale, name).toBeGreaterThan(0);
      expect(m.height, name).toBeGreaterThanOrEqual(0);
      expect(m.footprint, name).toHaveLength(2);
      expect(["hex", "m"]).toContain(m.footprintUnit);
      expect(Array.isArray(m.tags) && m.tags.length > 0, name).toBe(true);
    }
  });

  it("gives every banned model a reason and keeps it out of the first load", () => {
    for (const [name, m] of entries) {
      if (m.banned) {
        expect(m.reason.trim().length, name).toBeGreaterThan(0);
        expect(m.lazy, name).toBe(true);
      } else {
        expect(m.reason, name).toBe("");
      }
    }
  });

  it("bans every windmill, church and weapon rack", () => {
    for (const [name, m] of entries) {
      if (/windmill|church|weaponrack|barracks/.test(name)) {
        expect(m.banned, name).toBe(true);
      }
    }
  });

  it("lists animation clips on every character, and only there", () => {
    for (const [name, m] of entries) {
      if (m.kind === "character") {
        expect(m.animations?.length ?? 0, name).toBeGreaterThan(0);
        expect(m.height, name).toBeCloseTo(manifest.characterHeight, 2);
      } else {
        expect(m.animations, name).toBeUndefined();
      }
    }
  });

  it("strips the hand-held weapons from the KayKit adventurers", () => {
    for (const [name, m] of entries) {
      if (m.source === "kaykit-adventurers") {
        expect(m.stripped?.length ?? 0, name).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the first load under 8 MB", () => {
    const firstLoad = entries
      .filter(([, m]) => !m.lazy && !m.banned)
      .reduce((sum, [, m]) => sum + m.bytes, 0);
    expect(firstLoad).toBe(manifest.firstLoadBytes);
    expect(firstLoad).toBeLessThan(8 * 1024 * 1024);
  });
});
