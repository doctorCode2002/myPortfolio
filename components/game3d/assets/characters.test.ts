import { describe, expect, it } from "vitest";

import { readManifestFromDisk } from "@/lib/content/manifest3d.node";

import type { Manifest } from "../logic/types";
import {
  mayorModelFor,
  pickCheerClip,
  pickClips,
  playerModelFor,
} from "./characters";

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

describe("pickCheerClip", () => {
  it("prefers the KayKit Cheer clip, then a Kenney emote", () => {
    expect(pickCheerClip(["Idle", "Cheer", "Interact"])).toBe("Cheer");
    expect(pickCheerClip(["idle", "emote-yes", "interact-right"])).toBe(
      "interact-right"
    );
    expect(pickCheerClip(["idle", "walk"])).toBeNull();
  });
});

describe("real island owners", () => {
  const real = readManifestFromDisk();
  it.each([
    ["mayor_waco", "character-wejdan"],
    ["mayor_khidmty", "character-bahaa"],
    ["mayor_saleh", "character-saleh"],
    ["mayor_eyad", "character-eyad"],
    ["npc_teryaq_owner", "character-anas"],
  ])("%s uses %s, a mayor-only character with the KayKit clips", (id, name) => {
    expect(mayorModelFor(real, id, "char_0")).toBe(name);
    const m = real.models[name];
    expect(m?.kind).toBe("character");
    expect(m?.lazy).toBe(true);
    expect(m?.tags).toContain("mayor");
    expect(m?.tags).not.toContain("player");
    const clips = pickClips(m?.animations ?? []);
    expect(clips).toEqual({
      idle: "Idle",
      walk: "Walking_A",
      run: "Running_A",
    });
    expect(pickCheerClip(m?.animations ?? [])).toBe("Cheer");
    expect(m?.animations).toContain("Interact");
  });

  it("never offers them in the character picker", () => {
    for (const id of [
      "char_0",
      "char_1",
      "char_2",
      "char_3",
      "char_4",
      "char_5",
    ])
      expect(playerModelFor(real, id)).not.toMatch(
        /wejdan|bahaa|saleh|eyad|anas/
      );
  });
});
