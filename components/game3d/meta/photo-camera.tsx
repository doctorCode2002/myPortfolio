"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { damp, zoomToDistance } from "../logic/camera-math";
import { useRuntimeRef } from "../runtime";
import { metaRequests } from "./store";

/** The photo camera's free orbit around the player (written by the photo overlay). */
export const photoOrbit = {
  yaw: 0,
  pitch: 0.6,
  dist: 9,
  /** Set when photo mode opens, so the orbit starts from the follow camera's view. */
  fresh: true,
};

export const PHOTO_LIMITS = {
  pitchMin: (4 * Math.PI) / 180,
  pitchMax: (82 * Math.PI) / 180,
  distMin: 2.2,
  distMax: 34,
};

type FrameHandler = (frame: HTMLCanvasElement) => void;
let frameHandler: FrameHandler | null = null;

/** The photo overlay receives each captured frame (an unfiltered copy of the canvas). */
export function onPhotoFrame(cb: FrameHandler | null): void {
  frameHandler = cb;
}

/**
 * Photo mode's camera. While mounted it takes over rendering (a priority-1 frame
 * callback): it orbits the player freely, renders, and on a capture request copies the
 * freshly drawn frame into a 2D canvas in the same task, so the WebGL canvas needs no
 * preserveDrawingBuffer.
 */
export function PhotoCamera(): ReactNode {
  const rtRef = useRuntimeRef();
  const cur = useRef({ yaw: 0, pitch: 0.6, dist: 9 });
  const captured = useRef(metaRequests.capture);
  const target = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    const rt = rtRef.current;
    const balloon = rt.move.mode === "balloon";
    const dist = Math.min(
      PHOTO_LIMITS.distMax,
      zoomToDistance(rt.camera.zoom) * (balloon ? 2.2 : 1)
    );
    if (photoOrbit.fresh) {
      photoOrbit.yaw = rt.camera.yaw;
      photoOrbit.pitch = rt.camera.pitch;
      photoOrbit.dist = dist;
      photoOrbit.fresh = false;
    }
    cur.current = { ...photoOrbit };
    captured.current = metaRequests.capture;
    const p = rt.player.pos;
    target.current.set(p.x, p.y + (balloon ? 2.6 : 0.8), p.z);
    return () => {
      photoOrbit.fresh = true;
    };
  }, [rtRef]);

  useFrame(({ camera, gl, scene }, rawDt) => {
    const rt = rtRef.current;
    const dt = Math.min(rawDt, 0.05);
    const c = cur.current;
    const k = rt.reducedMotion ? 1 : damp(8, dt);
    c.yaw += (photoOrbit.yaw - c.yaw) * k;
    c.pitch += (photoOrbit.pitch - c.pitch) * k;
    c.dist += (photoOrbit.dist - c.dist) * k;
    const p = rt.player.pos;
    const t = target.current;
    // In the balloon, frame the rig (the basket and the envelope's lower half).
    t.set(p.x, p.y + (rt.move.mode === "balloon" ? 2.6 : 0.8), p.z);
    const horiz = Math.cos(c.pitch) * c.dist;
    camera.position.set(
      t.x + Math.sin(c.yaw) * horiz,
      t.y + Math.sin(c.pitch) * c.dist,
      t.z + Math.cos(c.yaw) * horiz
    );
    camera.lookAt(t);
    const fog = scene.fog as THREE.Fog | null;
    if (fog && "near" in fog) {
      fog.near = c.dist * 0.9 + 14;
      fog.far = c.dist * 0.9 + 110;
    }
    gl.render(scene, camera);
    if (metaRequests.capture !== captured.current) {
      captured.current = metaRequests.capture;
      const src = gl.domElement;
      const copy = document.createElement("canvas");
      copy.width = src.width;
      copy.height = src.height;
      const ctx = copy.getContext("2d");
      if (ctx) {
        ctx.drawImage(src, 0, 0);
        frameHandler?.(copy);
      }
    }
  }, 1);

  return null;
}
