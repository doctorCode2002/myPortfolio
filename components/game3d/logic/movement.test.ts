import { describe, expect, it } from "vitest";

import { ISLANDS_3D } from "@/content/islands3d";
import { readManifestFromDisk } from "@/lib/content/manifest3d.node";
import { BRIDGES, ISLANDS } from "@/lib/content/world";
import { readModelBoundsFromDisk } from "./bounds.node";
import {
  CAR,
  carOnRoad,
  createCarEnv,
  createCarState,
  pushBodies,
  stepCar,
  walkerAhead,
  walkerGap,
  type CarInput,
} from "./car";
import { canStand } from "./collision";
import {
  cancelGlide,
  canCancelGlide,
  createGlide,
  findLanding,
  GLIDE,
  stepGlide,
  thermalLift,
  type GlideEnv,
  type GlideEvent,
} from "./glide";
import { hexSpiral } from "./hex";
import { arcClearance, arcPoint, makeArc } from "./jump-arc";
import {
  buildMovementLayout,
  nearestMoveSpot,
  solidTopAt,
  type MovementLayout,
} from "./movement-layout";
import { cellNodeId } from "./pathfinding";
import { buildRails } from "./rails";
import { buildRoadNetwork, onRoad } from "./roads";
import type { Island3D } from "./types";
import { buildWalkWorld, surfaceAt } from "./walk-world";
import { riderPoint, stepZip, ZIP_FEET, zipLandingOk } from "./zipline";
import {
  buildGameWorld,
  nearestInteractable,
  PLAYER_RADIUS_HEX,
} from "./world-layout";

const manifest = readManifestFromDisk();
// With the mayors, like the game (their colliders and talk prompts count).
const MAYORS = Object.fromEntries(
  ISLANDS.map((i) => [
    i.id,
    i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
  ])
);
const world = buildGameWorld(ISLANDS_3D, BRIDGES, MAYORS, manifest, {
  bounds: readModelBoundsFromDisk(ISLANDS_3D, manifest),
});
const radius = PLAYER_RADIUS_HEX * world.hexWidth;
const layout = world.movement;

function disc(
  id: string,
  r: number,
  center: [number, number],
  extra: Partial<Island3D> = {}
): Island3D {
  return {
    id,
    center,
    hexes: hexSpiral({ q: 0, r: 0 }, r).map((h) => ({
      ...h,
      tile: "hex-grass",
    })),
    spawns: { player: { q: 0, r: 0 } },
    ...extra,
  };
}

/** A flat test world: one disc island with an optional lookout, no thermals by default. */
function flatEnv(
  extra: Partial<Island3D> = {},
  thermals = false
): GlideEnv & {
  layout: MovementLayout;
} {
  const islands = [disc("flat", 4, [0, 0], extra)];
  const walk = buildWalkWorld(islands, [], {});
  const lay = buildMovementLayout(islands, walk, null);
  if (!thermals) lay.thermals = [];
  return { walk, layout: lay, radius: 0.4 };
}

/** Wide open bounds for measuring steady flight. */
function openSky(): GlideEnv {
  const env = flatEnv();
  env.layout.radius = 1e4;
  env.layout.killY = -1e4;
  return env;
}

function fly(
  env: GlideEnv,
  s: ReturnType<typeof createGlide>,
  seconds: number,
  input = { steer: 0, pitch: 0 }
): GlideEvent {
  let ev: GlideEvent = { kind: "fly" };
  for (let t = 0; t < seconds; t += 1 / 60) {
    ev = stepGlide(env, s, input, 1 / 60);
    if (ev.kind === "land" || ev.kind === "respawn") return ev;
  }
  return ev;
}

describe("movement layout", () => {
  it("has the launches, the 4-6 ground pads and the lookouts", () => {
    expect(layout.launches.map((l) => l.id).sort()).toEqual([
      "civicmind-terrace",
      "home-castle",
    ]);
    const ground = layout.pads.filter((p) => p.kind === "pad");
    expect(ground.length).toBeGreaterThanOrEqual(4);
    expect(ground.length).toBeLessThanOrEqual(6);
    expect(layout.lookouts.length).toBeGreaterThanOrEqual(2);
    // Every lookout has its way back down.
    for (const l of layout.lookouts)
      expect(layout.pads.some((p) => p.id === `${l.id}-down`)).toBe(true);
  });

  it("launch platforms stand on walkable ground", () => {
    for (const l of layout.launches) {
      const s = surfaceAt(world.walk, l.x, l.z, l.y);
      expect(s, l.id).not.toBeNull();
      expect(canStand(world.walk, l.x, l.z, radius, l.y), l.id).not.toBeNull();
    }
    const home = layout.launches.find((l) => l.id === "home-castle");
    expect(home?.y).toBeCloseTo(1, 1); // top of the castle plateau
  });

  it("every pad and its target are standable, and every arc clears the solids", () => {
    const top = (x: number, z: number): number =>
      solidTopAt(world.walk, layout, x, z, true);
    for (const pad of layout.pads) {
      expect(
        canStand(world.walk, pad.x, pad.z, radius, pad.y),
        `${pad.id} start`
      ).not.toBeNull();
      const t = pad.target;
      expect(
        canStand(world.walk, t.x, t.z, radius, t.y),
        `${pad.id} target`
      ).not.toBeNull();
      expect(pad.clearance, `${pad.id} clearance`).toBeGreaterThan(0.1);
      // Re-sample finer, independently of the planner.
      expect(arcClearance(pad.arc, top, 0.3, 160), pad.id).toBeGreaterThan(0);
      const end = arcPoint(pad.arc, pad.arc.duration, { x: 0, y: 0, z: 0 });
      expect(Math.hypot(end.x - t.x, end.z - t.z)).toBeLessThan(1e-6);
      expect(end.y).toBeCloseTo(t.y, 6);
    }
  });

  it("lookout decks are standable from the deck but never reachable on foot", () => {
    for (const l of layout.lookouts) {
      expect(canStand(world.walk, l.x, l.z, radius, l.y), l.id).not.toBeNull();
      // From the ground the deck is out of step height, and the hex is no nav node.
      expect(canStand(world.walk, l.x, l.z, radius, l.groundY)).toBeNull();
      expect(world.nav.nodes.has(cellNodeId(l.islandId, l.q, l.r))).toBe(false);
      // Walking off the edge is impossible: the rim is not standable at deck height.
      expect(canStand(world.walk, l.x + l.radius, l.z, radius, l.y)).toBeNull();
    }
  });

  it("no door, mayor or car prompt shadows a pad, launch or zipline", () => {
    const spots = [...layout.pads, ...layout.launches, ...layout.ziplines];
    for (const s of spots)
      expect(
        nearestInteractable(world.interactables, s.x, s.y, s.z)?.item.id,
        s.id
      ).toBeUndefined();
  });

  it("finds the prompt spot near a pad or a launch", () => {
    const pad = layout.pads[0];
    if (!pad) throw new Error("no pads");
    expect(nearestMoveSpot(layout, pad.x, pad.y, pad.z)?.kind).toBe("pad");
    const l = layout.launches[0];
    if (!l) throw new Error("no launches");
    expect(nearestMoveSpot(layout, l.x + 0.3, l.y, l.z)?.kind).toBe("launch");
    expect(nearestMoveSpot(layout, l.x + 5, l.y, l.z)).toBeNull();
  });

  it("puts thermals over the waterfalls and the island centres", () => {
    const falls = layout.thermals.filter((t) => t.kind === "falls");
    const centres = layout.thermals.filter((t) => t.kind === "centre");
    expect(centres.length).toBe(world.islands.length);
    expect(falls.length).toBeGreaterThan(4);
  });
});

describe("zipline", () => {
  const line = layout.ziplines.find((z) => z.id === "home-eyad-zip");

  it("runs from home's castle plateau down to eyad", () => {
    expect(line).toBeDefined();
    if (!line) return;
    expect(line.islandId).toBe("home");
    expect(line.toIslandId).toBe("eyad");
    expect(line.a.y).toBeGreaterThan(line.b.y); // downhill
    expect(
      canStand(world.walk, line.start.x, line.start.z, radius, line.start.y)
    ).not.toBeNull();
    expect(zipLandingOk(world.walk, line, radius)).toBe(true);
    // At the end the feet are just above the far ground.
    const end = riderPoint(line, 1, { x: 0, y: 0, z: 0 });
    expect(end.y - line.end.y).toBeGreaterThan(0);
    expect(end.y - line.end.y).toBeLessThan(0.4);
  });

  it("the rider clears everything solid on the way", () => {
    if (!line) return;
    const p = { x: 0, y: 0, z: 0 };
    for (let i = 1; i < 200; i++) {
      riderPoint(line, i / 200, p);
      const near0 = Math.hypot(p.x - line.start.x, p.z - line.start.z) < 1;
      const near1 = Math.hypot(p.x - line.end.x, p.z - line.end.z) < 1;
      if (near0 || near1) continue;
      const top = solidTopAt(world.walk, layout, p.x, p.z, true);
      expect(p.y, `t=${i / 200}`).toBeGreaterThan(top + 0.1);
    }
    expect(ZIP_FEET).toBeGreaterThan(1.2);
  });

  it("a ride arrives in a few seconds", () => {
    if (!line) return;
    const s = { line, t: 0, speed: 1.5 };
    let time = 0;
    while (!stepZip(s, 1 / 60) && time < 30) time += 1 / 60;
    expect(s.t).toBe(1);
    expect(time).toBeGreaterThan(2);
    expect(time).toBeLessThan(8);
  });
});

describe("arcs", () => {
  it("is ballistic: starts and ends on the endpoints and tops out at the apex", () => {
    const arc = makeArc({ x: 0, y: 0, z: 0 }, { x: 6, y: 3, z: 0 }, 5);
    const p = { x: 0, y: 0, z: 0 };
    arcPoint(arc, 0, p);
    expect(p).toEqual({ x: 0, y: 0, z: 0 });
    let maxY = -Infinity;
    for (let i = 0; i <= 200; i++)
      maxY = Math.max(maxY, arcPoint(arc, (i / 200) * arc.duration, p).y);
    expect(maxY).toBeCloseTo(5, 2);
    arcPoint(arc, arc.duration, p);
    expect(p.x).toBeCloseTo(6);
    expect(p.y).toBeCloseTo(3);
  });

  it("detects a wall in the way", () => {
    const arc = makeArc({ x: 0, y: 0, z: 0 }, { x: 6, y: 0, z: 0 }, 2);
    const wall = (x: number): number => (x > 2.5 && x < 3.5 ? 4 : 0);
    expect(arcClearance(arc, wall)).toBeLessThan(0);
    expect(arcClearance(arc, () => 0)).toBeGreaterThan(0);
  });
});

describe("glide physics", () => {
  it("sinks slowly at cruise, faster in a dive, slower in a flare", () => {
    const env = openSky();
    // High above the void, far from everything: measure the steady sink.
    const rate = (pitch: number): number => {
      const s = createGlide(60, 40, 60, 0, "x");
      s.age = 99; // past the launch gust
      fly(env, s, 4, { steer: 0, pitch });
      const y0 = s.y;
      fly(env, s, 1, { steer: 0, pitch });
      return y0 - s.y;
    };
    const cruise = rate(0);
    expect(cruise).toBeGreaterThan(GLIDE.sink * 0.85);
    expect(cruise).toBeLessThan(GLIDE.sink * 1.15);
    expect(rate(1)).toBeGreaterThan(cruise * 1.8);
    expect(rate(-1)).toBeLessThan(cruise);
  });

  it("glides forward along its heading and banks into turns", () => {
    const env = openSky();
    const s = createGlide(60, 40, 60, 0, "x");
    s.age = 99;
    fly(env, s, 2);
    expect(s.z).toBeGreaterThan(60 + 2 * GLIDE.flareSpeed * 0.9);
    expect(Math.abs(s.x - 60)).toBeLessThan(1e-6);
    const h = s.heading;
    fly(env, s, 1, { steer: 1, pitch: 0 });
    expect(s.bank).toBeGreaterThan(0.3);
    expect(s.heading).toBeLessThan(h); // right turn: clockwise from above
  });

  it("the launch gust lifts at first", () => {
    const env = openSky();
    const s = createGlide(60, 40, 60, 0, "x");
    fly(env, s, 0.8);
    expect(s.y).toBeGreaterThan(40);
  });

  it("thermals lift: inside the core the glider climbs, above the ceiling it doesn't", () => {
    const env = flatEnv({}, true);
    const t = env.layout.thermals[0];
    if (!t) throw new Error("no thermal");
    expect(
      thermalLift(env.layout.thermals, t.x, t.ceiling - 5, t.z)
    ).toBeCloseTo(t.strength);
    expect(thermalLift(env.layout.thermals, t.x, t.ceiling + 1, t.z)).toBe(0);
    expect(thermalLift(env.layout.thermals, t.x + t.radius + 0.1, 0, t.z)).toBe(
      0
    );
    // Circling in the home falls thermal gains height.
    const falls = layout.thermals.find((x) => x.kind === "falls");
    if (!falls) throw new Error("no falls");
    const s = createGlide(falls.x, falls.ceiling - 6, falls.z, 0, "x");
    s.age = 99;
    s.speed = GLIDE.flareSpeed;
    const genv: GlideEnv = { walk: world.walk, layout, radius };
    const y0 = s.y;
    for (let i = 0; i < 120; i++) {
      stepGlide(genv, s, { steer: 1, pitch: -1 }, 1 / 60);
      // Stay in the core for the measurement.
      s.x = falls.x;
      s.z = falls.z;
    }
    expect(s.y).toBeGreaterThan(y0);
  });

  it("lands on walkable ground at a standable spot", () => {
    const env = flatEnv();
    const s = createGlide(-6, 1.5, 0, Math.PI / 2, "x");
    s.age = 99;
    const ev = fly(env, s, 20, { steer: 0, pitch: 1 });
    expect(ev.kind).toBe("land");
    if (ev.kind !== "land") return;
    expect(canStand(env.walk, ev.x, ev.z, 0.4, ev.y)).not.toBeNull();
  });

  it("asks for a respawn below the islands or off the map", () => {
    const env = flatEnv();
    const s = createGlide(40, 2, 0, Math.PI / 2, "x");
    s.age = 99;
    expect(fly(env, s, 60, { steer: 0, pitch: 1 }).kind).toBe("respawn");
    const far = createGlide(env.layout.radius + 50, 30, 0, 0, "x");
    expect(stepGlide(env, far, { steer: 0, pitch: 0 }, 1 / 60).kind).toBe(
      "respawn"
    );
  });

  it("bounces off a cliff face instead of flying into the island", () => {
    const env = flatEnv({ baseY: 5 });
    // Below the island top, flying at its side.
    const s = createGlide(-12, 2, 0, Math.PI / 2, "x");
    s.age = 99;
    let bumped = false;
    for (let i = 0; i < 300; i++) {
      const ev = stepGlide(env, s, { steer: 0, pitch: 0 }, 1 / 60);
      if (ev.kind === "bump") bumped = true;
      expect(solidTopAt(env.walk, env.layout, s.x, s.z)).toBeLessThan(s.y);
    }
    expect(bumped).toBe(true);
  });

  it("cancels only over ground, then drops and lands", () => {
    const env = flatEnv();
    const over = createGlide(0, 4, 0, 0, "x");
    expect(canCancelGlide(env, over)).toBe(true);
    const off = createGlide(30, 4, 0, 0, "x");
    expect(canCancelGlide(env, off)).toBe(false);
    cancelGlide(over);
    const ev = fly(env, over, 3);
    expect(ev.kind).toBe("land");
  });
});

describe("a skilled flight", () => {
  /** Steer towards a point (-1..1, + right), like a pilot would. */
  const steerTo = (
    s: { x: number; z: number; heading: number },
    x: number,
    z: number
  ): number => {
    let d = Math.atan2(x - s.x, z - s.z) - s.heading;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.max(-1, Math.min(1, -d * 2));
  };

  it("climbs in home's thermal and reaches the other islands", () => {
    const launch = layout.launches.find((l) => l.id === "home-castle");
    if (!launch) throw new Error("no launch");
    const env: GlideEnv = { walk: world.walk, layout, radius };
    for (const target of ["eyad", "civicmind", "khidmty"]) {
      const goal = world.islands.find((i) => i.id === target);
      if (!goal) throw new Error(target);
      const s = createGlide(
        launch.x,
        launch.y + 0.2,
        launch.z,
        launch.heading,
        launch.id
      );
      let climbing = true;
      let ev: GlideEvent = { kind: "fly" };
      for (let t = 0; t < 240; t += 1 / 60) {
        let steer: number;
        let pitch = 0;
        if (climbing) {
          // Circle over the island centre, slow, until high enough.
          const d = Math.hypot(s.x, s.z);
          steer = d > 2 ? steerTo(s, 0, 0) : 1;
          pitch = -0.3;
          if (s.y > launch.y + 6) climbing = false;
        } else steer = steerTo(s, goal.center[0], goal.center[1]);
        ev = stepGlide(env, s, { steer, pitch }, 1 / 60);
        if (ev.kind === "land" || ev.kind === "respawn") break;
      }
      expect(ev.kind, target).toBe("land");
      expect(surfaceAt(world.walk, s.x, s.z, s.y)?.islandId, target).toBe(
        target
      );
    }
  });
});

describe("landing finder", () => {
  it("returns the point itself when standable, else the nearest ring spot", () => {
    const env = flatEnv({
      objects: [{ model: "rock-large", q: 0, r: 0, solid: true }],
    });
    const g = surfaceAt(env.walk, 2, 0)?.y ?? 0;
    expect(findLanding(env.walk, 2, 0, g, 0.4)).toEqual({ x: 2, y: g, z: 0 });
    const spot = findLanding(env.walk, 0, 0, g, 0.4);
    expect(spot).not.toBeNull();
    if (!spot) return;
    expect(Math.hypot(spot.x, spot.z)).toBeGreaterThan(0.2);
    expect(canStand(env.walk, spot.x, spot.z, 0.4, g)).not.toBeNull();
  });

  it("finds nothing over the void", () => {
    const env = flatEnv();
    expect(findLanding(env.walk, 50, 50, 0, 0.4)).toBeNull();
  });

  it("lands a glider on a lookout deck", () => {
    const env = flatEnv({
      movement: {
        lookouts: [{ id: "look", q: 0, r: 0, height: 3, down: { q: 1, r: 0 } }],
      },
    });
    const look = env.layout.lookouts[0];
    if (!look) throw new Error("no lookout");
    const spot = findLanding(env.walk, look.x, look.z, look.y, 0.4);
    expect(spot?.y).toBeCloseTo(look.y);
  });
});

describe("car and walkers", () => {
  const islands = [disc("lot", 5, [0, 0])];
  const walk = buildWalkWorld(islands, [], {
    npcs: [{ islandId: "lot", q: 0, r: 3, id: "mayor_lot", radius: 0.35 }],
  });
  const env = createCarEnv(walk, buildRails(walk), new Set());
  const mayor = env.movers.find((o) => o.shape === "circle");
  const GAS: CarInput = { throttle: 1, steer: 0, handbrake: false };

  it("keeps the mayors live, out of the static index", () => {
    expect(env.movers.length).toBe(1);
    expect(mayor?.source).toBe("mayor_lot");
    for (const list of env.obstacles.buckets.values())
      for (const o of list) expect(o.source).not.toBe("mayor_lot");
  });

  it("reads a walker's live position (no ghost at the spawn)", () => {
    if (!mayor) throw new Error("no mayor");
    const spawn = { x: mayor.x, z: mayor.z };
    // The mayor walks away: the car may now drive through their spawn hex.
    mayor.x = spawn.x + 6;
    expect(walkerGap(env, spawn.x, spawn.z, 0)).toBeGreaterThan(1);
    expect(
      walkerAhead(env, { x: spawn.x, z: spawn.z - 3, heading: 0 }, 1)
    ).toBe(Infinity);
    // And back in the lane ahead: the query sees them.
    mayor.x = spawn.x;
    const d = walkerAhead(env, { x: spawn.x, z: spawn.z - 3, heading: 0 }, 1);
    expect(d).toBeCloseTo(3 - 0.35, 5);
    expect(
      walkerAhead(env, { x: spawn.x, z: spawn.z - 3, heading: 0 }, -1)
    ).toBe(Infinity);
  });

  it("stops for a mayor in its lane, never driving through them", () => {
    if (!mayor) throw new Error("no mayor");
    const s = createCarState(mayor.x, 0, mayor.z - 6, 0);
    let minGap = Infinity;
    for (let i = 0; i < 240; i++) {
      stepCar(env, s, GAS, 1 / 60);
      minGap = Math.min(minGap, walkerGap(env, s.x, s.z, s.heading));
    }
    expect(minGap).toBeGreaterThan(0);
    expect(Math.abs(s.speed)).toBeLessThan(0.5);
    // Once they walk off, the car goes on.
    mayor.x += 5;
    for (let i = 0; i < 60; i++) stepCar(env, s, GAS, 1 / 60);
    expect(s.speed).toBeGreaterThan(2);
    mayor.x -= 5;
  });

  it("pushes the player aside gently instead of running them over", () => {
    if (!mayor) throw new Error("no mayor");
    mayor.radius = 0; // out of the way for this one
    const player = { x: 0, z: 1.6, radius: 0.4, push: true };
    env.bodies.push(player);
    try {
      const s = createCarState(0, 0, -4, 0);
      s.speed = 2;
      for (let i = 0; i < 180; i++) {
        stepCar(env, s, { throttle: 0.3, steer: 0, handbrake: false }, 1 / 60);
        expect(walkerGap(env, s.x, s.z, s.heading)).toBeGreaterThan(-0.05);
      }
      // A direct push moves them off the car's footprint onto standable ground.
      player.x = 0;
      player.z = s.z + 0.3;
      expect(pushBodies(env, s.x, s.z, s.heading, 0)).toBe(true);
      expect(walkerGap(env, s.x, s.z, s.heading)).toBeGreaterThanOrEqual(0);
      expect(canStand(walk, player.x, player.z, 0.4, 0)).not.toBeNull();
    } finally {
      env.bodies.length = 0;
      mayor.radius = 0.35;
    }
  });
});

describe("car on roads", () => {
  const home = world.islands.find((i) => i.id === "home");
  const grid = world.walk.islands.find((g) => g.islandId === "home");
  if (!home || !grid) throw new Error("no home");
  const net = buildRoadNetwork(home, grid, {
    heightJitter: home.heightJitter ?? 0,
  });

  it("knows when it is on a ribbon", () => {
    const seg = net.segments;
    const x = seg[0] ?? 0;
    const z = seg[1] ?? 0;
    expect(onRoad(net, x, z)).toBe(true);
    expect(carOnRoad(world.carEnv, { x, z, islandId: "home" })).toBe(true);
    expect(carOnRoad(world.carEnv, { x: 500, z: 500, islandId: "home" })).toBe(
      false
    );
  });

  it("reaches a higher top speed on the road than off it", () => {
    const islands = [disc("lot", 6, [0, 0])];
    const walk = buildWalkWorld(islands, [], {});
    const roadNet = { ...net, islandId: "lot", segments: [-50, 0, 50, 0] };
    const env = createCarEnv(
      walk,
      [],
      new Set(),
      [],
      new Map([["lot", roadNet]])
    );
    const top = (z: number): number => {
      const s = createCarState(-8, 0, z, Math.PI / 2);
      s.islandId = "lot";
      let best = 0;
      for (let i = 0; i < 90; i++) {
        stepCar(env, s, { throttle: 1, steer: 0, handbrake: false }, 1 / 60);
        best = Math.max(best, s.speed);
        if (s.x > 6) break;
      }
      return best;
    };
    expect(top(0)).toBeGreaterThan(top(4) * 1.05);
    expect(top(0)).toBeLessThanOrEqual(CAR.maxSpeed * CAR.roadBoost + 1e-6);
  });
});
