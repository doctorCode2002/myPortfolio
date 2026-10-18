"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { gameEvents } from "@/components/game/engine/events";
import {
  CAMERA,
  clampPitch,
  clampYaw,
  clampZoom,
  damp,
  stepZoom,
  zoomToDistance,
} from "../logic/camera-math";
import { findPath, raycastWalk } from "../logic/pathfinding";
import { PLAYER_RADIUS_HEX, type GameWorld } from "../logic/world-layout";
import { useRuntimeRef } from "../runtime";

const TAP_MOVE_PX = 8;
/** Camera distance multiplier and lead (metres at top speed) while driving. */
const DRIVE_DISTANCE = 1.4;
/** Pull-back while gliding, in units of the driving pull-back (1 + 0.4 * 1.8 = 1.72x). */
const GLIDE_PULL = 1.8;
const DRIVE_LEAD = 4;
const TAP_MS = 350;

function roundZoom(z: number): number {
  return Math.round(z * 10) / 10;
}

/**
 * Follow camera behind and above the player with a limited orbit (yaw ±60° around the
 * default north heading, pitch 30-65°), wheel / pinch / button zoom, smooth damping, and
 * the pointer handling for drag-to-orbit and click/tap-to-move.
 */
export function FollowCamera({ world }: { world: GameWorld }): ReactNode {
  const rtRef = useRuntimeRef();
  const camera = useThree((s) => s.camera);
  const lead = useRef({ x: 0, z: 0 });
  const gl = useThree((s) => s.gl);
  const smoothTarget = useRef(new THREE.Vector3());
  const goal = useRef<{ yaw: number; pitch: number; zoom: number }>({
    yaw: 0,
    pitch: CAMERA.pitchDefault,
    zoom: CAMERA.zoomDefault,
  });
  const first = useRef(true);
  const drivePull = useRef({ k: 0 });

  // Zoom buttons and external zoom requests.
  useEffect(() => {
    const announce = (): void =>
      gameEvents.emit("camera:zoom-changed", {
        zoom: roundZoom(goal.current.zoom),
      });
    announce();
    const offs = [
      gameEvents.on("camera:zoom-in", () => {
        goal.current.zoom = stepZoom(goal.current.zoom, 1);
        announce();
      }),
      gameEvents.on("camera:zoom-out", () => {
        goal.current.zoom = stepZoom(goal.current.zoom, -1);
        announce();
      }),
      gameEvents.on("camera:set-zoom", ({ zoom }) => {
        goal.current.zoom = clampZoom(zoom);
        announce();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // Pointer: drag to orbit, wheel / pinch to zoom, tap to walk.
  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<
      number,
      { x: number; y: number; sx: number; sy: number; t: number }
    >();
    let pinchDist = 0;
    let announceTimer: ReturnType<typeof setTimeout> | null = null;
    const announceSoon = (): void => {
      if (announceTimer) clearTimeout(announceTimer);
      announceTimer = setTimeout(
        () =>
          gameEvents.emit("camera:zoom-changed", {
            zoom: roundZoom(goal.current.zoom),
          }),
        120
      );
    };
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const tapToMove = (clientX: number, clientY: number): void => {
      const rt = rtRef.current;
      if (rt.frozen || rt.move.mode !== "walk") return;
      const rect = el.getBoundingClientRect();
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const o = raycaster.ray.origin;
      const d = raycaster.ray.direction;
      const hit = raycastWalk(
        world.walk,
        { x: o.x, y: o.y, z: o.z },
        { x: d.x, y: d.y, z: d.z },
        160,
        0.08
      );
      if (!hit) return;
      const path = findPath(
        world.walk,
        world.nav,
        rt.player.pos,
        hit,
        PLAYER_RADIUS_HEX * world.hexWidth
      );
      if (path && path.length > 0) {
        rt.path = path;
        rt.target = path[path.length - 1] ?? hit;
      }
    };

    const onDown = (e: PointerEvent): void => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        t: performance.now(),
      });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      }
    };
    const onMove = (e: PointerEvent): void => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        if (Math.hypot(p.x - p.sx, p.y - p.sy) < TAP_MOVE_PX) return;
        goal.current.yaw = clampYaw(goal.current.yaw - dx * 0.006);
        goal.current.pitch = clampPitch(goal.current.pitch + dy * 0.005);
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        if (!a || !b) return;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0 && dist > 0) {
          goal.current.zoom = clampZoom(goal.current.zoom * (dist / pinchDist));
          announceSoon();
        }
        pinchDist = dist;
      }
    };
    const onUp = (e: PointerEvent): void => {
      const p = pointers.get(e.pointerId);
      const wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId))
        el.releasePointerCapture(e.pointerId);
      if (!p || !wasSingle || e.type === "pointercancel") return;
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (
        moved < TAP_MOVE_PX &&
        performance.now() - p.t < TAP_MS &&
        e.button === 0
      ) {
        tapToMove(e.clientX, e.clientY);
      }
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      goal.current.zoom = clampZoom(
        goal.current.zoom * Math.exp(-e.deltaY * 0.0015)
      );
      announceSoon();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      if (announceTimer) clearTimeout(announceTimer);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl, camera, world, rtRef]);

  useFrame((state, rawDt) => {
    const rt = rtRef.current;
    const dt = Math.min(rawDt, 0.05);
    const p = rt.player.pos;
    const cam = rt.camera;
    const k = first.current ? 1 : damp(6, dt);
    cam.yaw += (goal.current.yaw - cam.yaw) * k;
    cam.pitch += (goal.current.pitch - cam.pitch) * k;
    cam.zoom += (goal.current.zoom - cam.zoom) * k;
    const t = smoothTarget.current;
    const car = rt.car.driving ? rt.car.state : null;
    const kt = first.current ? 1 : damp(car ? 5 : 8, dt);
    // Lead in the travel direction so the view opens up ahead: a little for walking,
    // a lot more for the car (it is fast and the orbit stays limited).
    const l = lead.current;
    const heading = car ? car.heading : rt.player.heading;
    const run = car
      ? (Math.min(1, Math.abs(car.speed) / 16) *
          Math.sign(car.speed) *
          DRIVE_LEAD) /
        CAMERA.lead
      : Math.min(1, rt.player.speed / 4.4);
    const kl = damp(car ? 1.6 : 2.5, dt);
    l.x += (Math.sin(heading) * CAMERA.lead * run - l.x) * kl;
    l.z += (Math.cos(heading) * CAMERA.lead * run - l.z) * kl;
    t.x += (p.x + l.x - t.x) * kt;
    t.y +=
      (p.y + 0.55 - t.y) * damp(4, dt) + (first.current ? p.y + 0.55 - t.y : 0);
    t.z += (p.z + l.z - t.z) * kt;
    first.current = false;
    // Pull back while driving (eased so getting in and out glides).
    const pull = drivePull.current;
    const pullTo = car ? 1 : rt.move.mode === "glide" ? GLIDE_PULL : 0;
    pull.k += (pullTo - pull.k) * damp(2.5, dt);
    const dist = zoomToDistance(cam.zoom) * (1 + (DRIVE_DISTANCE - 1) * pull.k);
    const horiz = Math.cos(cam.pitch) * dist;
    // Impact shake (never with reduced motion: the car system leaves it at 0 then).
    let sx = 0;
    let sy = 0;
    if (rt.shake > 0.001) {
      const a = rt.shake * 0.18;
      const tt = state.clock.elapsedTime * 47;
      sx = Math.sin(tt) * a;
      sy = Math.sin(tt * 1.3 + 1) * a * 0.6;
      rt.shake *= Math.exp(-dt * 7);
    } else rt.shake = 0;
    camera.position.set(
      t.x + Math.sin(cam.yaw) * horiz + sx,
      t.y + Math.sin(cam.pitch) * dist + sy,
      t.z + Math.cos(cam.yaw) * horiz
    );
    camera.lookAt(t);
    // Fog starts past the player at any zoom, so far islands sink into the haze.
    const fog = state.scene.fog as THREE.Fog | null;
    if (fog && "near" in fog) {
      fog.near = dist * 0.9 + 14;
      fog.far = dist * 0.9 + 95;
    }
  });

  return null;
}
