import { describe, expect, it } from "vitest";

import type { Manifest } from "../logic/types";
import { mayorModelFor, pickClips, playerModelFor } from "./characters";

const manifest: Manifest = {
  version: 1,
  models: {
    "character-rogue": { file: "a.glb", kind: "character", tags: ["player"] },
    "character-knight": {
      file: "b.glb",
      kind: "character",
      tags: ["player"],
      banned: true,
    },
    "character-mini-male-b": {
      file: "c.glb",
      kind: "character",
      tags: ["mayor"],
    },
  },
};

describe("character table", () => {
  it("maps picker ids to allowed models and falls back stably", () => {
    expect(playerModelFor(manifest, "char_0")).toBe("character-rogue");
    // char_1 prefers knight models: knight-bare is missing and knight is banned.
    expect(playerModelFor(manifest, "char_1")).toBe("character-rogue");
    expect(playerModelFor(null, "char_0")).toBeNull();
    expect(mayorModelFor(manifest, "mayor_khidmty", "char_3")).toBe(
      "character-mini-male-b"
    );
  });

  it("picks idle / walk / run clips for KayKit and Kenney naming", () => {
    expect(
      pickClips([
        "Idle",
        "Unarmed_Idle",
        "Walking_A",
        "Walking_Backwards",
        "Running_A",
      ])
    ).toEqual({
      idle: "Idle",
      walk: "Walking_A",
      run: "Running_A",
    });
    expect(pickClips(["static", "idle", "walk", "sprint"])).toEqual({
      idle: "idle",
      walk: "walk",
      run: "sprint",
    });
    expect(pickClips(["Walking_Backwards"]).walk).toBeNull();
  });
});
