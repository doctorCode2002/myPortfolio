import { describe, expect, it } from "vitest";
import { mergeManifestFragments } from "./manifest-merge";
import type { Manifest, ManifestModel } from "./types";

const model = { file: "a.glb", kind: "prop" } as unknown as ManifestModel;
const base: Manifest = { version: 1, models: { a: model } };

describe("mergeManifestFragments", () => {
  it("adds fragment models", () => {
    const m = mergeManifestFragments(base, [
      { name: "custom-a.json", fragment: { models: { b: model } } },
    ]);
    expect(Object.keys(m.models).sort()).toEqual(["a", "b"]);
  });
  it("refuses a model name that already exists", () => {
    expect(() =>
      mergeManifestFragments(base, [
        { name: "custom-a.json", fragment: { models: { a: model } } },
      ])
    ).toThrow(/already exists/);
  });
});
