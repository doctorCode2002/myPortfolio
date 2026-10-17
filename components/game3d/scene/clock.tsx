"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";

import { sharedUniforms } from "../fx/shared-time";
import { useRuntimeRef } from "../runtime";

/** Drives the shared shader time and measures fps for the debug overlay. */
export function ShaderClock(): ReactNode {
  const rtRef = useRuntimeRef();
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
