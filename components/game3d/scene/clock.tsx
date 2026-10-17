"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";

import { sharedUniforms } from "../fx/shared-time";
import { useRuntimeRef } from "../runtime";

/** Drives the shared shader time and measures fps for the debug overlay. */
export function ShaderClock(): ReactNode {
  const rtRef = useRuntimeRef();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __game3dGl?: unknown };
    w.__game3dGl = { gl, scene };
    return () => {
      delete w.__game3dGl;
    };
  }, [gl, scene]);
  const frames = useRef({ n: 0, t: 0 });
  useFrame(({ clock }, dt) => {
    const rt = rtRef.current;
    sharedUniforms.uMotion.value = rt.reducedMotion ? 0 : 1;
    if (!rt.reducedMotion) sharedUniforms.uTime.value = clock.elapsedTime;
    const f = frames.current;
    f.n += 1;
    f.t += dt;
    if (f.t >= 0.5) {
      rt.fps = Math.round(f.n / f.t);
      f.n = 0;
      f.t = 0;
    }
  });
  return null;
}
