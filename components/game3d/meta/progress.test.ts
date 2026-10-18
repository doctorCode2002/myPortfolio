import { describe, expect, it } from "vitest";

import { SHARDS } from "@/lib/content/collectibles";
import {
  addTo,
  crossedBridge,
  emptyProgress,
  evaluateAchievements,
  parseProgress,
  PROGRESS_VERSION,
  SMASH_GOAL,
} from "./progress";
import { relativeBearing } from "./placement";

const rules = { mayorIslands: ["a", "b"], bridgeIds: ["home-a", "home-b"] };

describe("progress", () => {
  it("round-trips through JSON and drops unknown ids", () => {
    const p = emptyProgress();
    addTo(p, "visited", "home");
    addTo(p, "shards", SHARDS[0]!.id);
    p.smashed = 7;
    const back = parseProgress(
      JSON.stringify({
        ...p,
        visited: [...p.visited, "atlantis"],
        shards: [...p.shards, "nope"],
      })
    );
    expect(back.visited).toEqual(["home"]);
    expect(back.shards).toEqual([SHARDS[0]!.id]);
    expect(back.smashed).toBe(7);
  });

  it("starts fresh on broken JSON or another version", () => {
    expect(parseProgress("{oops").visited).toEqual([]);
    expect(
      parseProgress(
        JSON.stringify({ v: PROGRESS_VERSION + 1, visited: ["home"] })
      ).visited
    ).toEqual([]);
  });

  it("unlocks each achievement once", () => {
    const p = emptyProgress();
    expect(evaluateAchievements(p, rules)).toEqual([]);
    p.smashed = SMASH_GOAL;
    p.night = true;
    addTo(p, "tours", "a");
    expect(evaluateAchievements(p, rules).sort()).toEqual(
      ["nightOwl", "smash50", "tour"].sort()
    );
    expect(evaluateAchievements(p, rules)).toEqual([]);
    addTo(p, "mayors", "a");
    addTo(p, "mayors", "b");
    addTo(p, "bridges", "home-a");
    expect(evaluateAchievements(p, rules)).toEqual(["mayorsAll"]);
    addTo(p, "bridges", "home-b");
    expect(evaluateAchievements(p, rules)).toEqual(["bridgesAll"]);
    for (const s of SHARDS) addTo(p, "shards", s.id);
    expect(evaluateAchievements(p, rules)).toEqual(["shardsAll"]);
  });

  it("counts a bridge only when driven end to end", () => {
    const b = { from: "home", to: "a" };
    expect(crossedBridge(b, "home", "a")).toBe(true);
    expect(crossedBridge(b, "a", "home")).toBe(true);
    expect(crossedBridge(b, "home", "home")).toBe(false);
    expect(crossedBridge(b, null, "a")).toBe(false);
  });
});

describe("compass bearing", () => {
  it("is 0 straight ahead and positive to the right of the camera", () => {
    // Yaw 0: the camera looks toward -z, so +x is to the right.
    expect(relativeBearing(0, -5, 0)).toBeCloseTo(0);
    expect(relativeBearing(5, 0, 0)).toBeCloseTo(Math.PI / 2);
    expect(relativeBearing(-5, 0, 0)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(relativeBearing(0, 5, 0))).toBeCloseTo(Math.PI);
  });
});
