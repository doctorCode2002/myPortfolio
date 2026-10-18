import { describe, expect, it } from "vitest";

import type { Vec3 } from "../logic/walk-world";
import {
  BRAIN,
  cancelTour,
  createBrain,
  startTour,
  stepBrain,
  type BrainEnv,
  type BrainInput,
  type MayorBrain,
} from "./mayor-brain";

const p = (x: number, z: number): Vec3 => ({ x, y: 0, z });

function env(over: Partial<BrainEnv> = {}): BrainEnv {
  return {
    route: [p(0, 0), p(4, 0), p(4, 4)],
    routeMode: "pingpong",
    stops: [p(-4, 0), p(-4, 4)],
    restHeading: 0,
    plan: (_from, to) => [{ ...to }],
    groundY: () => 0,
    ...over,
  };
}

const far = p(100, 100);

function run(
  b: MayorBrain,
  e: BrainEnv,
  seconds: number,
  input: Partial<BrainInput> = {}
): void {
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt)
    stepBrain(b, e, {
      dt,
      player: far,
      playerActive: true,
      talking: false,
      ...input,
    });
}

describe("mayor brain", () => {
  it("walks the route, pausing at each waypoint", () => {
    const e = env();
    const b = createBrain(p(0, 0), 0);
    const seen = new Set<number>();
    let walked = false;
    let paused = false;
    for (let i = 0; i < 30 * 40; i++) {
      stepBrain(b, e, {
        dt: 1 / 30,
        player: far,
        playerActive: true,
        talking: false,
      });
      if (b.anim === "walk") walked = true;
      if (b.anim === "idle" && !b.path) paused = true;
      if (!b.path) seen.add(b.routeIndex);
    }
    expect(walked).toBe(true);
    expect(paused).toBe(true);
    expect([...seen].filter((i) => i >= 0).sort()).toEqual([0, 1, 2]);
  });

  it("greets once with the cheer clip when the player comes close", () => {
    const e = env();
    const b = createBrain(p(0, 0), 0);
    run(b, e, 0.1, { player: p(2, 0) });
    expect(b.anim).toBe("cheer");
    expect(b.heading).toBeCloseTo(Math.PI / 2);
    run(b, e, BRAIN.cheerTime + 0.2, { player: p(2, 0) });
    expect(b.anim).not.toBe("cheer");
    run(b, e, 0.2, { player: p(2, 0) });
    expect(b.anim).not.toBe("cheer");
    // Leaving and coming back greets again.
    run(b, e, 0.1, { player: far });
    run(b, e, 0.1, { player: { ...b.pos, x: b.pos.x + 2 } });
    expect(b.anim).toBe("cheer");
  });

  it("stands still and faces the player while talking", () => {
    const e = env();
    const b = createBrain(p(0, 0), 0);
    b.pause = 0;
    run(b, e, 0.5, { player: p(0, -2), talking: true });
    expect(b.pos).toEqual(p(0, 0));
    expect(Math.abs(b.heading)).toBeCloseTo(Math.PI);
  });

  it("does not walk into the player", () => {
    const e = env({ route: [p(0, 0), p(6, 0), p(6, 6)] });
    const b = createBrain(p(0, 0), 0);
    b.greeted = true;
    b.pause = 0;
    run(b, e, 6, { player: p(3, 0) });
    expect(Math.hypot(b.pos.x - 3, b.pos.z)).toBeGreaterThanOrEqual(
      BRAIN.blockDist - 1e-6
    );
  });

  it("guides the tour: walks, waits for the player, speaks at each stop, then returns", () => {
    const e = env();
    const b = createBrain(p(0, 0), 0);
    b.greeted = true;
    startTour(b, e);
    expect(b.mode).toBe("tour");
    expect(b.bubble).toBe("follow");
    // The player follows a step behind the mayor.
    const follow = (seconds: number): void => {
      const dt = 1 / 30;
      for (let t = 0; t < seconds; t += dt)
        stepBrain(b, e, {
          dt,
          player: { x: b.pos.x + 1.5, y: 0, z: b.pos.z },
          playerActive: true,
          talking: false,
        });
    };
    follow(5);
    expect(b.stage).toBe("speak");
    expect(b.stop).toBe(0);
    expect(b.pos.x).toBeCloseTo(-4);
    follow(BRAIN.lineTime + 5);
    expect(b.stop).toBe(1);
    follow(BRAIN.lineTime + BRAIN.doneTime + 1);
    expect(b.mode).not.toBe("tour");
    expect(b.bubble).toBeNull();
  });

  it("waits when the player lags behind and cancels when they walk away", () => {
    const e = env();
    const b = createBrain(p(0, 0), 0);
    b.greeted = true;
    startTour(b, e);
    run(b, e, 1, { player: p(8, 0) });
    expect(b.pos.x).toBe(0);
    expect(b.mode).toBe("tour");
    run(b, e, BRAIN.abandonTime + 0.5, { player: p(40, 0) });
    expect(b.mode).not.toBe("tour");
  });

  it("cancelTour walks back to the nearest route waypoint", () => {
    const e = env();
    const b = createBrain(p(4, 3), 0);
    startTour(b, e);
    cancelTour(b, e);
    expect(b.mode).toBe("return");
    expect(b.routeIndex).toBe(2);
    run(b, e, 3);
    expect(b.mode).toBe("route");
  });
});
