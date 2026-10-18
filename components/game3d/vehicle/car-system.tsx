"use client";

import { useFrame } from "@react-three/fiber";
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";

import { allowedModel, modelUrl } from "../assets/manifest";
import { breakProp, tickRegrow } from "../logic/breakables";
import {
  carFits,
  createCarState,
  findExitSpot,
  spotOccupied,
  stepCar,
  syncWalkWorld,
  type CarInput,
} from "../logic/car";
import type { Manifest } from "../logic/types";
import { surfaceAt } from "../logic/walk-world";
import {
  moveVehiclePrompt,
  PLAYER_RADIUS_HEX,
  VEHICLE_RANGE,
  type GameWorld,
} from "../logic/world-layout";
import { emitSoundCue } from "../audio/sound-store";
import { surfaceBob } from "../entities/player";
import { setDriving, useRuntimeRef, type Runtime } from "../runtime";
import { CarModel, FallbackCar, type CarWheels } from "./car-model";

/** Rapier (and its WASM) only loads once the player is this close to the car, or gets in. */
export const PHYSICS_PRELOAD_RANGE = 7;
/** The car controller runs at a fixed rate. */
const STEP = 1 / 120;
const MAX_STEPS = 10;
/** World radius of the Kenney sedan's wheels (for the spin). */
const WHEEL_RADIUS = 0.2;

const LazyCarPhysics = lazy(() => import("./car-physics"));

function carInput(rt: Runtime): CarInput {
  if (rt.frozen) return { throttle: 0, steer: 0, handbrake: true };
  const k = rt.input.keys;
  let throttle = 0;
  let steer = 0;
  if (k.has("KeyW") || k.has("ArrowUp")) throttle += 1;
  if (k.has("KeyS") || k.has("ArrowDown")) throttle -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) steer += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) steer -= 1;
  const joy = rt.input.joy;
  if (throttle === 0 && steer === 0 && Math.hypot(joy.x, joy.y) > 0.12) {
    throttle = joy.y;
    steer = joy.x;
  }
  return { throttle, steer, handbrake: k.has("Space") };
}

/**
 * The drivable car: parks at the island's vehicle spot, takes the player in and out
 * (E / tap), runs the arcade controller on the walk world at a fixed step, smashes
 * breakable props (hide + regrow through the break store), and lazy-loads the physics
 * module for the flying chunks only when the player gets close.
 */
export function CarSystem({
  world,
  manifest,
}: {
  world: GameWorld;
  manifest: Manifest | null;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const group = useRef<THREE.Group>(null);
  const wheels = useRef<CarWheels>({ all: [], front: [] });
  const acc = useRef(0);
  const frame = useRef(0);
  const spin = useRef(0);
  const [physics, setPhysics] = useState(false);
  const spawn = world.vehicles[0];
  const model = allowedModel(manifest, "vehicle-car");
  const url = modelUrl(manifest, "vehicle-car");
  const playerRadius = PLAYER_RADIUS_HEX * world.hexWidth;

  // Park the car on its spawn once; a world rebuild keeps it where it is. The walk world
  // reads the break store and treats the parked car as an obstacle.
  useLayoutEffect(() => {
    const rt = rtRef.current;
    if (!rt.car.state && spawn) {
      const fit = carFits(
        world.carEnv,
        spawn.x,
        spawn.z,
        spawn.heading,
        spawn.y
      );
      rt.car.state = createCarState(
        spawn.x,
        fit?.surface.y ?? spawn.y,
        spawn.z,
        spawn.heading
      );
      rt.car.state.islandId = spawn.islandId;
    }
    const car = rt.car.state;
    syncWalkWorld(world.walk, rt.props.broken, rt.car.driving ? null : car);
  }, [world, spawn, rtRef]);

  // E gets out (getting in is the "Drive" prompt in Interactions).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const rt = rtRef.current;
      if (e.repeat || e.code !== "KeyE" || !rt.car.driving || rt.frozen) return;
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      e.preventDefault();
      rt.car.request = "exit";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rtRef]);

  useFrame(({ clock }, rawDt) => {
    const rt = rtRef.current;
    const car = rt.car.state;
    if (!car) return;
    const dt = Math.min(rawDt, 0.05);
    const now = performance.now();
    const p = rt.player.pos;

    // Get in / out.
    const req = rt.car.request;
    rt.car.request = null;
    // Getting in only from walking (never while gliding or mid-jump).
    if (
      req === "enter" &&
      !rt.car.driving &&
      !rt.frozen &&
      rt.move.mode === "walk"
    ) {
      if (Math.hypot(p.x - car.x, p.z - car.z) <= VEHICLE_RANGE + 0.6) {
        car.speed = 0;
        acc.current = 0;
        syncWalkWorld(world.walk, rt.props.broken, null);
        rt.path = null;
        rt.target = null;
        setDriving(rt, true);
      }
    } else if (req === "exit" && rt.car.driving) {
      const spot = findExitSpot(world.walk, car, playerRadius);
      if (spot) {
        car.speed = 0;
        car.steer = 0;
        p.x = spot.x;
        p.y = spot.y;
        p.z = spot.z;
        rt.player.heading = Math.atan2(spot.x - car.x, spot.z - car.z);
        syncWalkWorld(world.walk, rt.props.broken, car);
        setDriving(rt, false);
      }
    }

    // Drive at a fixed step; smash props; shake on impacts (not with reduced motion).
    if (rt.car.driving) {
      const input = carInput(rt);
      acc.current = Math.min(acc.current + dt, STEP * MAX_STEPS);
      while (acc.current >= STEP) {
        acc.current -= STEP;
        const res = stepCar(world.carEnv, car, input, STEP);
        for (const o of res.hits) {
          const prop = o.key ? world.props.get(o.key) : undefined;
          if (!prop || !breakProp(rt.props, prop.key, now)) continue;
          rt.breaks.push({
            key: prop.key,
            x: prop.x,
            y: prop.y,
            z: prop.z,
            rotY: prop.rotY,
            size: prop.size,
            palette: prop.palette,
            tall: prop.tall,
            vx: Math.sin(car.heading) * car.speed,
            vz: Math.cos(car.heading) * car.speed,
          });
          if (!rt.reducedMotion) rt.shake = Math.max(rt.shake, 0.3);
          emitSoundCue({ kind: "impact", strength: 0.7 });
        }
        if (res.bump > 3) {
          if (!rt.reducedMotion)
            rt.shake = Math.max(rt.shake, Math.min(1, res.bump / 12));
          emitSoundCue({
            kind: "impact",
            strength: Math.min(1, res.bump / 12),
          });
        }
      }
      // Without the physics module (still loading) nobody drains the chunk queue.
      if (rt.breaks.length > 24) rt.breaks.splice(0, rt.breaks.length - 24);
    }

    // Regrow smashed props unless the car or the player stands on their spot.
    tickRegrow(rt.props, now, (key) => {
      const prop = world.props.get(key);
      if (!prop) return true;
      return !spotOccupied(
        prop.obstacle,
        car,
        rt.car.driving ? null : { x: p.x, z: p.z, radius: playerRadius }
      );
    });

    // The "Drive" prompt follows the car.
    moveVehiclePrompt(world.interactables, car);

    // Lazy physics: preload near the car, always when driving.
    frame.current = (frame.current + 1) % 15;
    if (!physics && frame.current === 0) {
      const d = Math.hypot(p.x - car.x, p.z - car.z);
      if (rt.car.driving || d < PHYSICS_PRELOAD_RANGE) setPhysics(true);
    }

    // Pose the model: ground tilt, wheel spin and steering.
    const g = group.current;
    if (g) {
      const s = surfaceAt(world.walk, car.x, car.z, car.y);
      g.position.set(
        car.x,
        car.y + surfaceBob(world, s, clock.elapsedTime, rt.reducedMotion),
        car.z
      );
      g.rotation.set(-car.pitch, car.heading, car.roll, "YXZ");
    }
    spin.current += (car.speed * dt) / WHEEL_RADIUS;
    for (const w of wheels.current.all) w.rotation.x = spin.current;
    for (const w of wheels.current.front) w.rotation.y = -car.steer * 0.45;
  });

  if (!spawn) return null;
  return (
    <>
      <group ref={group} name="car">
        {url && model ? (
          <Suspense fallback={<FallbackCar />}>
            <CarModel
              url={url}
              scale={model.scale ?? 1}
              onWheels={(w) => {
                wheels.current = w;
              }}
            />
          </Suspense>
        ) : (
          <FallbackCar />
        )}
      </group>
      {physics && (
        <Suspense fallback={null}>
          <LazyCarPhysics world={world} />
        </Suspense>
      )}
    </>
  );
}
