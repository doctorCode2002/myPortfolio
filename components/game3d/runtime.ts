/**
 * Mutable per-mount runtime state shared by the scene systems (player, camera, input,
 * interactions, debug). It is read and written inside useFrame, so it lives outside React
 * state; React only re-renders on coarse changes (the nearest interactable).
 */

import { createContext, useContext, type RefObject } from "react";

import { createBreakStore, type BreakStore } from "./logic/breakables";
import { CAMERA } from "./logic/camera-math";
import type { CarState } from "./logic/car";
import type { Vec3 } from "./logic/walk-world";
import type { Interactable } from "./logic/world-layout";

/** A smashed prop for the physics module to shatter into chunks. */
export type BreakEvent = {
  key: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  size: [number, number, number];
  palette: string[];
  tall: boolean;
  /** Car velocity at impact (m/s). */
  vx: number;
  vz: number;
};

export type Runtime = {
  input: {
    keys: Set<string>;
    /** Virtual joystick: x right, y forward, magnitude 0..1. */
    joy: { x: number; y: number };
  };
  player: {
    pos: Vec3;
    /** Facing angle around +y (0 faces +z). */
    heading: number;
    speed: number;
    islandId: string | null;
    bridgeId: string | null;
    hex: { q: number; r: number } | null;
  };
  camera: { yaw: number; pitch: number; zoom: number };
  /** Click/tap-to-move waypoints. */
  path: Vec3[] | null;
  /** Click/tap target marker. */
  target: Vec3 | null;
  nearest: Interactable | null;
  /** Island to spawn on (dev ?island=<id>); kept so world rebuilds respawn there. */
  spawnIsland: string;
  /** A pending dev teleport request (debug overlay buttons). */
  teleport: string | null;
  /** True once the player has been placed in some world. */
  placed: boolean;
  frozen: boolean;
  /** performance.now() when the UI last unfroze (guards key repeats from the overlays). */
  unfrozenAt: number;
  fps: number;
  reducedMotion: boolean;
  car: {
    /** The car's pose and speed (null until a world with a vehicle is built). */
    state: CarState | null;
    driving: boolean;
    /** Pending enter / exit request, handled in the car system's frame. */
    request: "enter" | "exit" | null;
    /** Subscribers to `driving` (the HUD). */
    listeners: Set<() => void>;
  };
  /** Broken / regrowing props (the walk world reads its `broken` map). */
  props: BreakStore;
  /** Smashes waiting for the physics module to spawn chunks. */
  breaks: BreakEvent[];
  /** Camera shake amount (0..1), decays; never set with reduced motion. */
  shake: number;
};

export function createRuntime(reducedMotion: boolean): Runtime {
  return {
    input: { keys: new Set(), joy: { x: 0, y: 0 } },
    player: {
      pos: { x: 0, y: 0, z: 0 },
      heading: Math.PI,
      speed: 0,
      islandId: null,
      bridgeId: null,
      hex: null,
    },
    camera: { yaw: 0, pitch: CAMERA.pitchDefault, zoom: CAMERA.zoomDefault },
    path: null,
    target: null,
    nearest: null,
    spawnIsland: "home",
    teleport: null,
    placed: false,
    frozen: false,
    unfrozenAt: 0,
    fps: 0,
    reducedMotion,
    car: { state: null, driving: false, request: null, listeners: new Set() },
    props: createBreakStore(),
    breaks: [],
    shake: 0,
  };
}

/** Switch between walking and driving, and tell the subscribers. */
export function setDriving(rt: Runtime, driving: boolean): void {
  if (rt.car.driving === driving) return;
  rt.car.driving = driving;
  for (const cb of rt.car.listeners) cb();
}

export function subscribeDriving(rt: Runtime, cb: () => void): () => void {
  rt.car.listeners.add(cb);
  return () => {
    rt.car.listeners.delete(cb);
  };
}

/**
 * The runtime travels as a ref so systems can mutate it from frame callbacks and event
 * handlers (never during render).
 */
export const RuntimeContext = createContext<RefObject<Runtime> | null>(null);

/** The runtime when inside World3D, else null (shared components like the gallery). */
export function useOptionalRuntimeRef(): RefObject<Runtime> | null {
  return useContext(RuntimeContext);
}

export function useRuntimeRef(): RefObject<Runtime> {
  const ref = useContext(RuntimeContext);
  if (!ref) throw new Error("useRuntimeRef outside World3D");
  return ref;
}

/** Island bob offset at time t (seconds); a pure function so every system agrees. */
export function islandBob(
  islandId: string | null,
  t: number,
  reducedMotion: boolean
): number {
  if (!islandId || reducedMotion) return 0;
  let h = 0;
  for (let i = 0; i < islandId.length; i++)
    h = (h * 31 + islandId.charCodeAt(i)) % 1000;
  return Math.sin(t * 0.55 + h) * 0.06;
}
