/**
 * The drivable car: an arcade, drift-free controller on the walk world (the same
 * surfaces the player walks on, so it climbs the 0.5 m terrace steps and ramps, crosses
 * the bridges and never leaves the walkable area), with collision against the rim and
 * bridge rails and the island obstacles. Breakable props hit above a small speed are
 * reported as hits instead of blocking. Also: the exit-spot finder and the regrow check.
 * Pure: no three, rapier or react imports.
 *
 * The car's footprint is three circles along its axis; heading 0 faces +z and the
 * forward vector is (sin heading, cos heading), like the player.
 */

import { canStand, nearestStandable } from "./collision";
import {
  createSpatialIndex,
  queryIndex,
  railBounds,
  railDistance,
  type Rail,
  type SpatialIndex,
} from "./rails";
import { onRoad, type RoadNetwork } from "./roads";
import { obstacleDistance, obstacleReach, type Obstacle } from "./walk-grid";
import { surfaceAt, type Surface, type WalkWorld } from "./walk-world";

export const CAR = {
  /** Body size (metres): the curated Kenney sedan is 1.0 x 0.87 x 1.71. */
  width: 1.0,
  length: 1.71,
  /** Footprint circles: radius and offsets along the heading. */
  radius: 0.46,
  offsets: [-0.42, 0, 0.42] as const,
  maxSpeed: 16,
  maxReverse: 6,
  /** Throttle acceleration at standstill (m/s²); it tapers to half near top speed. */
  accel: 13,
  reverseAccel: 9,
  /** Braking (S while rolling forward) and the handbrake (Space). */
  brake: 30,
  handbrake: 22,
  /** Rolling resistance with no throttle. */
  coast: 4,
  /** Yaw rate at full steer (rad/s) once rolling. */
  turnRate: 2.5,
  /** Steering wheel response (1/s). */
  steerRate: 9,
  /** Props hit at or above this speed break; slower hits are blocked like walls. */
  breakSpeed: 2.5,
  /** Speed kept per smashed prop. */
  smashKeep: 0.9,
  /** On a road ribbon: top speed and acceleration factor, and extra steering grip. */
  roadBoost: 1.15,
  roadGrip: 1.12,
  /** Slows for a walker ahead: starts this far (plus the braking distance) from them. */
  yieldGap: 0.9,
} as const;

export type CarState = {
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Signed forward speed (m/s). */
  speed: number;
  /** Current steering (-1 left .. 1 right), eased towards the input. */
  steer: number;
  /** Nose-up pitch and +x-side-up roll (radians), from the ground under the wheels. */
  pitch: number;
  roll: number;
  islandId: string | null;
  bridgeId: string | null;
};

export type CarInput = {
  /** -1 (brake / reverse) .. 1 (accelerate). */
  throttle: number;
  /** -1 (left) .. 1 (right). */
  steer: number;
  handbrake: boolean;
};

/**
 * A walker the car must not drive through, read live each step: the mayors' colliders
 * (moved in place as they walk) and, via `bodies`, the player or other walkers. Pushable
 * bodies are nudged aside gently if there is room, others make the car stop.
 */
export type CarBody = {
  x: number;
  z: number;
  radius: number;
  /** Push it aside (the player) instead of stopping for it. */
  push?: boolean;
};

/** Collision data for the car: static parts built once per world, walkers read live. */
export type CarEnv = {
  world: WalkWorld;
  rails: SpatialIndex<Rail>;
  /** Static obstacles (props, buildings): never the walkers. */
  obstacles: SpatialIndex<Obstacle>;
  /** Obstacle keys that break on impact. */
  breakable: ReadonlySet<string>;
  /** The mayors' live colliders (the same objects the walk world moves). */
  movers: Obstacle[];
  /** Other walkers, refreshed by the car system before each step (the player on foot). */
  bodies: CarBody[];
  /** Road networks by island (a little faster and grippier on the ribbons). */
  roads: ReadonlyMap<string, RoadNetwork>;
};

export function createCarEnv(
  world: WalkWorld,
  rails: readonly Rail[],
  breakable: ReadonlySet<string>,
  /** Car-only colliders of non-solid breakable props. */
  sensors: readonly Obstacle[] = [],
  roads: ReadonlyMap<string, RoadNetwork> = new Map()
): CarEnv {
  // Island objects carry a key; keyless grid obstacles are the walking mayors, whose
  // colliders move, so they are checked live instead of from the bucket index.
  const grid = world.islands.flatMap((g) => g.obstacles);
  const all = [...grid.filter((o) => o.key !== undefined), ...sensors];
  return {
    movers: grid.filter((o) => o.key === undefined),
    bodies: [],
    roads,
    world,
    rails: createSpatialIndex(rails, railBounds),
    obstacles: createSpatialIndex(all, (o) => {
      const r = obstacleReach(o);
      return { x0: o.x - r, z0: o.z - r, x1: o.x + r, z1: o.z + r };
    }),
    breakable,
  };
}

export function createCarState(
  x: number,
  y: number,
  z: number,
  heading: number
): CarState {
  return {
    x,
    y,
    z,
    heading,
    speed: 0,
    steer: 0,
    pitch: 0,
    roll: 0,
    islandId: null,
    bridgeId: null,
  };
}

/** Centres of the footprint circles for a pose. */
export function carCircles(
  x: number,
  z: number,
  heading: number
): { x: number; z: number }[] {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return CAR.offsets.map((o) => ({ x: x + fx * o, z: z + fz * o }));
}

const RIM = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)] as const;
});

export type FitResult = {
  /** Surface under the middle of the car. */
  surface: Surface;
  /** Ground height under the front and back circles, and the two sides. */
  front: number;
  back: number;
  left: number;
  right: number;
};

/**
 * Whether the car fits at a pose coming from height `fromY`: every footprint circle
 * needs ground within one step of `fromY` all around it, no rail and no obstacle may
 * cut it. Breakable obstacles count as hits (pushed to `hits`) when `smash` is true,
 * else they block. Broken props are ignored.
 */
export function carFits(
  env: CarEnv,
  x: number,
  z: number,
  heading: number,
  fromY: number,
  smash = false,
  hits?: Obstacle[],
  /** Ignore obstacles (ground and rails still count): to drive out of an overlap. */
  ghost = false,
  /**
   * Smallest allowed gap to the walkers (0: no overlap). While already overlapping one,
   * pass the current (negative) gap: the car may only move away.
   */
  walkerFloor = 0
): FitResult | null {
  const { world } = env;
  const r = CAR.radius;
  const circles = carCircles(x, z, heading);
  const ys: number[] = [];
  let mid: Surface | null = null;
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i] as { x: number; z: number };
    const s = surfaceAt(world, c.x, c.z, fromY);
    if (!s || Math.abs(s.y - fromY) > world.maxStep) return null;
    for (const [dx, dz] of RIM) {
      const e = surfaceAt(world, c.x + dx * r, c.z + dz * r, s.y);
      if (!e || Math.abs(e.y - s.y) > world.maxStep) return null;
    }
    for (const rail of queryIndex(env.rails, c.x, c.z, r))
      if (railDistance(rail, c.x, c.z) < r) return null;
    if (!ghost)
      for (const o of queryIndex(env.obstacles, c.x, c.z, r)) {
        if (o.key !== undefined && world.broken.has(o.key)) continue;
        if (obstacleDistance(o, c.x, c.z) >= r) continue;
        if (smash && o.key !== undefined && env.breakable.has(o.key)) {
          if (hits && !hits.includes(o)) hits.push(o);
          continue;
        }
        return null;
      }
    ys.push(s.y);
    if (i === 1) mid = s;
  }
  if (!mid) return null;
  if (walkerGap(env, x, z, heading) < walkerFloor - 1e-6) return null;
  // Side heights for the roll (half a width out from the middle).
  const sx = Math.cos(heading) * (CAR.width / 2);
  const sz = -Math.sin(heading) * (CAR.width / 2);
  const left = surfaceAt(world, x + sx, z + sz, mid.y)?.y ?? mid.y;
  const right = surfaceAt(world, x - sx, z - sz, mid.y)?.y ?? mid.y;
  return {
    surface: mid,
    back: ys[0] ?? mid.y,
    front: ys[2] ?? mid.y,
    left,
    right,
  };
}

/**
 * The smallest gap between the car's footprint at a pose and the walkers (the mayors and
 * the bodies); negative when overlapping, Infinity with nobody around.
 */
export function walkerGap(
  env: Pick<CarEnv, "movers" | "bodies">,
  x: number,
  z: number,
  heading: number
): number {
  let gap = Infinity;
  if (!env.movers.length && !env.bodies.length) return gap;
  for (const c of carCircles(x, z, heading)) {
    for (const o of env.movers) {
      if (o.shape === "circle" && o.radius <= 0) continue;
      gap = Math.min(gap, obstacleDistance(o, c.x, c.z) - CAR.radius);
    }
    for (const b of env.bodies)
      gap = Math.min(
        gap,
        Math.hypot(b.x - c.x, b.z - c.z) - b.radius - CAR.radius
      );
  }
  return gap;
}

/**
 * Free distance ahead of (or behind, when reversing) the car to the nearest walker in its
 * lane (centre to their rim), Infinity when the lane is clear. The car slows for it.
 */
export function walkerAhead(
  env: Pick<CarEnv, "movers" | "bodies">,
  s: Pick<CarState, "x" | "z" | "heading">,
  dir: 1 | -1,
  lane: number = CAR.width / 2 + 0.25
): number {
  const fx = Math.sin(s.heading) * dir;
  const fz = Math.cos(s.heading) * dir;
  let best = Infinity;
  const test = (x: number, z: number, radius: number): void => {
    const dx = x - s.x;
    const dz = z - s.z;
    const along = dx * fx + dz * fz;
    if (along <= 0) return;
    const side = Math.abs(dx * fz - dz * fx);
    if (side > lane + radius) return;
    best = Math.min(best, along - radius);
  };
  for (const o of env.movers) {
    if (o.shape !== "circle" || o.radius <= 0) continue;
    test(o.x, o.z, o.radius);
  }
  for (const b of env.bodies) test(b.x, b.z, b.radius);
  return best;
}

/**
 * Nudge pushable bodies out of the car's footprint at a pose (each only to a spot where
 * it can stand). Returns false if one could not make room (the car then stops).
 */
export function pushBodies(
  env: CarEnv,
  x: number,
  z: number,
  heading: number,
  fromY: number
): boolean {
  let ok = true;
  for (const b of env.bodies) {
    if (!b.push) continue;
    for (const c of carCircles(x, z, heading)) {
      const dx = b.x - c.x;
      const dz = b.z - c.z;
      const d = Math.hypot(dx, dz);
      const need = CAR.radius + b.radius + 0.02;
      if (d >= need) continue;
      // Out sideways from the car's axis when dead ahead.
      const ux = d > 1e-4 ? dx / d : Math.cos(heading);
      const uz = d > 1e-4 ? dz / d : -Math.sin(heading);
      const px = c.x + ux * need;
      const pz = c.z + uz * need;
      if (canStand(env.world, px, pz, b.radius, fromY)) {
        b.x = px;
        b.z = pz;
      } else ok = false;
    }
  }
  return ok;
}

/** Whether the car is on one of its island's road ribbons. */
export function carOnRoad(
  env: Pick<CarEnv, "roads">,
  s: Pick<CarState, "x" | "z" | "islandId">
): boolean {
  const net = s.islandId ? env.roads.get(s.islandId) : undefined;
  return net ? onRoad(net, s.x, s.z, 0.1) : false;
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export type StepResult = {
  /** Breakable obstacles smashed during this step. */
  hits: Obstacle[];
  /** Impact speed when the car hit something solid head-on (0 otherwise). */
  bump: number;
};

/**
 * Advance the car by dt seconds: speed from throttle / brake / handbrake, yaw from the
 * steering (scaled by speed, so it never spins on the spot and never drifts), then the
 * move, sub-stepped and sliding along walls like the player's collider.
 */
export function stepCar(
  env: CarEnv,
  s: CarState,
  input: CarInput,
  dt: number
): StepResult {
  const hits: Obstacle[] = [];
  let bump = 0;
  const road = carOnRoad(env, s);
  const top = CAR.maxSpeed * (road ? CAR.roadBoost : 1);
  const accel = CAR.accel * (road ? CAR.roadBoost : 1);

  // Speed.
  const throttle = Math.max(-1, Math.min(1, input.throttle));
  if (input.handbrake) {
    s.speed = approach(s.speed, 0, CAR.handbrake * dt);
  } else if (throttle > 0.01) {
    if (s.speed < -0.2) s.speed = approach(s.speed, 0, CAR.brake * dt);
    else {
      const taper = 1 - 0.5 * Math.min(1, Math.max(0, s.speed) / top);
      s.speed = Math.min(
        top * throttle,
        s.speed + accel * throttle * taper * dt
      );
      if (s.speed > top * throttle)
        s.speed = approach(s.speed, top * throttle, CAR.coast * dt);
    }
  } else if (throttle < -0.01) {
    if (s.speed > 0.2) s.speed = approach(s.speed, 0, CAR.brake * dt);
    else
      s.speed = Math.max(
        -CAR.maxReverse * -throttle,
        s.speed - CAR.reverseAccel * -throttle * dt
      );
  } else {
    s.speed = approach(s.speed, 0, CAR.coast * dt);
  }

  // Yield to walkers in the lane: never faster than what still stops short of them.
  if (Math.abs(s.speed) > 1e-3) {
    const gap =
      walkerAhead(env, s, s.speed > 0 ? 1 : -1) - CAR.length / 2 - CAR.yieldGap;
    const allowed = Math.sqrt(Math.max(0, gap) * CAR.brake);
    if (Math.abs(s.speed) > allowed) s.speed = Math.sign(s.speed) * allowed;
  }

  // Steering: yaw rate grows with speed (no turning on the spot) and eases off a little
  // at top speed; reversing turns the other way like a real car.
  s.steer = approach(
    s.steer,
    Math.max(-1, Math.min(1, input.steer)),
    CAR.steerRate * dt
  );
  const v = Math.abs(s.speed);
  const grip =
    Math.min(1, v / 3) *
    (1 - 0.4 * Math.min(1, v / top)) *
    (input.handbrake ? 1.35 : 1) *
    (road ? CAR.roadGrip : 1);
  const yaw = -s.steer * CAR.turnRate * grip * Math.sign(s.speed) * dt;

  const smash = v >= CAR.breakSpeed;
  // Overlapping something already (a teleport, a prop regrown under a stuck car)?
  // Then obstacles are ignored until the car is free again.
  const floor = Math.min(0, walkerGap(env, s.x, s.z, s.heading));
  const ghost = !carFits(
    env,
    s.x,
    s.z,
    s.heading,
    s.y,
    true,
    undefined,
    false,
    -Infinity
  );
  const dist = v * dt;
  const steps = Math.max(
    1,
    Math.ceil(Math.max(dist / 0.18, Math.abs(yaw) / 0.05))
  );
  let fit: FitResult | null = null;
  for (let i = 0; i < steps; i++) {
    // Turn first (only if the rotated footprint still fits).
    const h = s.heading + yaw / steps;
    const turned = carFits(env, s.x, s.z, h, s.y, smash, hits, ghost, floor);
    if (turned) {
      s.heading = h;
      fit = turned;
    }
    if (Math.abs(s.speed) < 1e-4) continue;
    const step = (s.speed * dt) / steps;
    const fx = Math.sin(s.heading) * step;
    const fz = Math.cos(s.heading) * step;
    let moved = false;
    if (env.bodies.length) pushBodies(env, s.x + fx, s.z + fz, s.heading, s.y);
    const direct = carFits(
      env,
      s.x + fx,
      s.z + fz,
      s.heading,
      s.y,
      smash,
      hits,
      ghost,
      floor
    );
    if (direct) {
      s.x += fx;
      s.z += fz;
      fit = direct;
      moved = true;
    } else {
      // Slide along the wall: the step deflected by growing angles, shortened by the
      // cosine; the car turns into the slide so it lines up with rails and walls.
      for (const deg of [15, 30, 45]) {
        const a = (deg * Math.PI) / 180;
        const k = Math.cos(a);
        for (const sign of [1, -1]) {
          const c = Math.cos(a * sign);
          const sn = Math.sin(a * sign);
          const dx = (fx * c + fz * sn) * k;
          const dz = (-fx * sn + fz * c) * k;
          const slid = carFits(
            env,
            s.x + dx,
            s.z + dz,
            s.heading,
            s.y,
            smash,
            hits,
            ghost,
            floor
          );
          if (!slid) continue;
          s.x += dx;
          s.z += dz;
          fit = slid;
          moved = true;
          // Scrape: lose speed by how hard the wall was hit, and align with it.
          s.speed *= 1 - (1 - k) * 0.35;
          const align = Math.sign(s.speed) * sign * a * 0.18;
          const h2 = s.heading + align;
          const ok = carFits(env, s.x, s.z, h2, s.y, smash, hits, ghost, floor);
          if (ok) {
            s.heading = h2;
            fit = ok;
          }
          break;
        }
        if (moved) break;
      }
    }
    if (!moved) {
      // Only a breakable prop in the way at low speed: push against it (the speed keeps
      // building until it gives) instead of bouncing off.
      if (
        !smash &&
        carFits(
          env,
          s.x + fx,
          s.z + fz,
          s.heading,
          s.y,
          true,
          undefined,
          ghost,
          floor
        )
      )
        break;
      // A walker in the way: just stop (no bounce, no shake).
      if (
        carFits(
          env,
          s.x + fx,
          s.z + fz,
          s.heading,
          s.y,
          smash,
          undefined,
          ghost,
          -Infinity
        )
      ) {
        s.speed = 0;
        break;
      }
      bump = Math.max(bump, Math.abs(s.speed));
      s.speed = -s.speed * 0.15;
      break;
    }
  }
  if (hits.length) s.speed *= Math.pow(CAR.smashKeep, hits.length);

  fit ??= carFits(
    env,
    s.x,
    s.z,
    s.heading,
    s.y,
    false,
    undefined,
    false,
    -Infinity
  );
  if (fit) {
    // Height and tilt follow the ground under the wheels (smoothed, never flips).
    const target = (fit.front + fit.back) / 2;
    s.y += (target - s.y) * damp(16, dt);
    if (Math.abs(target - s.y) > 0.7) s.y = target;
    const pitch = Math.atan2(fit.front - fit.back, CAR.offsets[2] * 2);
    const roll = Math.atan2(fit.left - fit.right, CAR.width);
    const lim = 0.45;
    s.pitch += (Math.max(-lim, Math.min(lim, pitch)) - s.pitch) * damp(10, dt);
    s.roll += (Math.max(-lim, Math.min(lim, roll)) - s.roll) * damp(10, dt);
    s.islandId = fit.surface.islandId;
    s.bridgeId = fit.surface.bridgeId;
  }
  return { hits, bump };
}

/**
 * Plug the runtime state into a (rebuilt) walk world: the break store's broken map, and
 * the parked car as a dynamic obstacle (none while it is being driven).
 */
export function syncWalkWorld(
  walk: WalkWorld,
  broken: { has(key: string): boolean },
  parked: Pick<CarState, "x" | "z" | "heading"> | null
): void {
  walk.broken = broken;
  walk.dynamic = parked ? [carObstacle(parked)] : [];
}

/** A box obstacle for the parked car (so the player walks around it). */
export function carObstacle(
  s: Pick<CarState, "x" | "z" | "heading">
): Obstacle {
  return {
    shape: "box",
    x: s.x,
    z: s.z,
    hx: CAR.width / 2,
    hz: CAR.length / 2,
    rot: s.heading,
    source: "vehicle",
  };
}

/** Plan-view distance from a point to the car's footprint (negative inside). */
export function distanceToCar(
  s: Pick<CarState, "x" | "z" | "heading">,
  x: number,
  z: number
): number {
  return obstacleDistance(carObstacle(s), x, z);
}

/**
 * Where the driver gets out: beside the car (left door, then right), then behind and in
 * front of it, then the nearest standable spot around it, always clear of the car body.
 */
export function findExitSpot(
  world: WalkWorld,
  s: Pick<CarState, "x" | "y" | "z" | "heading">,
  radius: number
): { x: number; y: number; z: number } | null {
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  // Local +x of the car (the driver's left when it faces +z in a right-handed y-up frame).
  const sx = fz;
  const sz = -fx;
  const side = CAR.width / 2 + radius + 0.15;
  const end = CAR.length / 2 + radius + 0.15;
  const clear = (x: number, z: number): boolean =>
    distanceToCar(s, x, z) >= radius + 0.05;
  const tries: [number, number][] = [
    [s.x + sx * side, s.z + sz * side],
    [s.x - sx * side, s.z - sz * side],
    [s.x - fx * end, s.z - fz * end],
    [s.x + fx * end, s.z + fz * end],
    [s.x + sx * side - fx * 0.5, s.z + sz * side - fz * 0.5],
    [s.x - sx * side - fx * 0.5, s.z - sz * side - fz * 0.5],
  ];
  for (const [x, z] of tries) {
    if (!clear(x, z)) continue;
    const st = canStand(world, x, z, radius, s.y);
    if (st) return { x, y: st.y, z };
  }
  // Rings around the car for tight spots (bridges, narrow paths).
  for (let ring = side; ring <= side + 4; ring += 0.25) {
    const n = Math.max(12, Math.round(ring * 14));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = s.x + Math.cos(a) * ring;
      const z = s.z + Math.sin(a) * ring;
      if (!clear(x, z)) continue;
      const st = canStand(world, x, z, radius, s.y);
      if (st) return { x, y: st.y, z };
    }
  }
  const any = nearestStandable(world, s.x, s.z, radius, 6);
  return any && clear(any.x, any.z)
    ? { x: any.x, y: any.surface.y, z: any.z }
    : null;
}

/**
 * Whether a regrowing prop's obstacle would overlap the car or a player circle, in which
 * case it waits (it must never trap or pop up inside them).
 */
export function spotOccupied(
  o: Obstacle,
  car: Pick<CarState, "x" | "z" | "heading"> | null,
  player: { x: number; z: number; radius: number } | null
): boolean {
  if (car) {
    for (const c of carCircles(car.x, car.z, car.heading))
      if (obstacleDistance(o, c.x, c.z) < CAR.radius + 0.1) return true;
  }
  if (player && obstacleDistance(o, player.x, player.z) < player.radius + 0.1)
    return true;
  return false;
}
