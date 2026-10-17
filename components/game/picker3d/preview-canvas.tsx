"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";

import { PreviewCharacter, PreviewLights } from "./preview-character";
import type { PreviewModel } from "./use-picker-manifest";

export type PreviewSlot = {
  charId: string;
  track: RefObject<HTMLElement | null>;
  model: PreviewModel;
  active: boolean;
};

/** In demand mode (reduced motion) the views only redraw when the page scrolls or resizes. */
function RedrawOnLayout({
  scroller,
}: {
  scroller: RefObject<HTMLElement | null>;
}): null {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const el = scroller.current;
    const redraw = (): void => invalidate();
    window.addEventListener("resize", redraw);
    el?.addEventListener("scroll", redraw, { passive: true });
    const ro = el ? new ResizeObserver(redraw) : null;
    if (el) ro?.observe(el);
    const t = setTimeout(redraw, 250);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", redraw);
      el?.removeEventListener("scroll", redraw);
      ro?.disconnect();
    };
  }, [invalidate, scroller]);
  return null;
}

/**
 * clip-path for a viewport-sized canvas so it only shows over `el`. The canvas itself stays at
 * the viewport origin (drei's View maths assumes that), and cards scrolled out of `el` are cut.
 */
function useClipTo(el: RefObject<HTMLElement | null>): string | undefined {
  const [clip, setClip] = useState<string | undefined>(undefined);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const measure = (): void => {
      const r = node.getBoundingClientRect();
      const w = window.innerWidth;
      const h = window.innerHeight;
      setClip(
        `inset(${Math.max(0, r.top)}px ${Math.max(0, w - r.right)}px ${Math.max(0, h - r.bottom)}px ${Math.max(0, r.left)}px)`
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [el]);
  return clip;
}

/**
 * ONE WebGL canvas over the picker's scroll area, drawing every card's character through a drei
 * View (a scissored viewport tracking the card's preview box). It is mounted only while the
 * picker is open, so nothing renders when it is closed.
 */
export function PreviewCanvas({
  slots,
  reducedMotion,
  scroller,
  onReady,
}: {
  slots: readonly PreviewSlot[];
  reducedMotion: boolean;
  scroller: RefObject<HTMLElement | null>;
  onReady: (charId: string) => void;
}): ReactNode {
  const clipPath = useClipTo(scroller);
  return (
    <Canvas
      className="pointer-events-none"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        clipPath: clipPath ?? "inset(50%)",
      }}
      frameloop={reducedMotion ? "demand" : "always"}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
        toneMapping: THREE.NeutralToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      aria-hidden
    >
      <RedrawOnLayout scroller={scroller} />
      {slots.map((slot, i) => (
        <View
          key={slot.charId}
          track={slot.track as RefObject<HTMLElement>}
          index={i + 1}
        >
          <PerspectiveCamera
            makeDefault
            fov={30}
            position={[0, 0.56, 2.15]}
            rotation={[-0.045, 0, 0]}
          />
          <PreviewLights />
          <PreviewCharacter
            charId={slot.charId}
            model={slot.model}
            active={slot.active}
            still={reducedMotion}
            poseTime={0.35}
            onReady={() => onReady(slot.charId)}
          />
        </View>
      ))}
    </Canvas>
  );
}
