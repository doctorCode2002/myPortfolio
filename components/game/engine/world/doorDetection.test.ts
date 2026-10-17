import { describe, expect, it } from "vitest";
import homeIslandJson from "@/public/game/islands/home/island.json";
import {
  findClosestDoor,
  findNearestDoor,
  type DoorCandidate,
} from "./doorDetection";

describe("findClosestDoor & findNearestDoor (pure door selection)", () => {
  const sampleDoors: DoorCandidate[] = [
    { buildingId: "door_a", at: [100, 100], radius: 30 },
    { buildingId: "door_b", at: [200, 100], radius: 25 },
    { buildingId: "door_c", at: [150, 200], radius: 40 },
  ];

  it("selects the nearest door when inside interaction radius", () => {
    // Player body at (105, 102), feetY = 102 + 12 = 114
    // distCenter = hypot(5, 2) = 5.38 <= 30
    const res = findClosestDoor(105, 102, sampleDoors, 0, 0);
    expect(res).not.toBeNull();
    expect(res?.id).toBe("door_a");
    expect(res?.dist).toBeCloseTo(5.385, 2);
  });

  it("chooses the closer door when two doors are within radius", () => {
    const overlappingDoors: DoorCandidate[] = [
      { buildingId: "door_close", at: [100, 100], radius: 50 },
      { buildingId: "door_closer", at: [108, 100], radius: 50 },
    ];
    const res = findClosestDoor(110, 100, overlappingDoors, 0, 0);
    expect(res?.id).toBe("door_closer");
  });

  it("returns null when player is outside all door radii", () => {
    const res = findClosestDoor(500, 500, sampleDoors, 0, 0);
    expect(res).toBeNull();
  });

  it("findNearestDoor returns closest door even when outside radius", () => {
    const nearest = findNearestDoor(500, 500, sampleDoors, 0, 0);
    expect(nearest).not.toBeNull();
    expect(nearest?.id).toBe("door_c");
    // door_c is at (150, 200), dist is hypot(350, 300) = ~460.97
    expect(nearest?.dist).toBeGreaterThan(400);
  });

  it("dual-distance check triggers when feet are within radius even if body center is further", () => {
    // Door at (100, 100), radius 20
    // Player body center at (100, 75), feet at (100, 87)
    // distCenter = 25 (> 20), distFeet = 13 (<= 20)
    const singleDoor: DoorCandidate[] = [
      { buildingId: "door_top", at: [100, 100], radius: 20 },
    ];
    const res = findClosestDoor(100, 75, singleDoor, 0, 0);
    expect(res).not.toBeNull();
    expect(res?.id).toBe("door_top");
    expect(res?.dist).toBe(13);
  });

  it("dual-distance check triggers when body center is within radius even if feet are further", () => {
    // Door at (100, 100), radius 20
    // Player body center at (100, 115), feet at (100, 127)
    // distCenter = 15 (<= 20), distFeet = 27 (> 20)
    const singleDoor: DoorCandidate[] = [
      { buildingId: "door_bottom", at: [100, 100], radius: 20 },
    ];
    const res = findClosestDoor(100, 115, singleDoor, 0, 0);
    expect(res).not.toBeNull();
    expect(res?.id).toBe("door_bottom");
    expect(res?.dist).toBe(15);
  });

  it("correctly identifies nearest door from home spawns.player", () => {
    const spawn = homeIslandJson.spawns.player as [number, number];
    expect(spawn).toEqual([401, 510]);

    const doors = homeIslandJson.doors as DoorCandidate[];

    // At spawn, no door is in active radius
    const active = findClosestDoor(spawn[0], spawn[1], doors, 0, 0);
    expect(active).toBeNull();

    // The nearest door from spawn is board_news
    const nearest = findNearestDoor(spawn[0], spawn[1], doors, 0, 0);
    expect(nearest).not.toBeNull();
    expect(nearest?.id).toBe("board_news");
    expect(nearest?.dist).toBeCloseTo(136.5, 0);
  });

  it("activates board_news when player walks to the base of the notice board", () => {
    const doors = homeIslandJson.doors as DoorCandidate[];
    // Player standing directly in front of the right notice board: (498, 414)
    const res = findClosestDoor(498, 414, doors, 0, 0);
    expect(res).not.toBeNull();
    expect(res?.id).toBe("board_news");
    expect(res?.dist).toBeLessThanOrEqual(36);
  });

  it("activates all home building doors when player is at their entrances", () => {
    const doors = homeIslandJson.doors as DoorCandidate[];
    for (const door of doors) {
      const res = findClosestDoor(door.at[0], door.at[1], doors, 0, 0);
      expect(res).not.toBeNull();
      expect(res?.id).toBe(door.buildingId);
    }
  });
});
