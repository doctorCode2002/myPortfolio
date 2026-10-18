"use client";

import { useRef, useState, type ReactNode } from "react";

import type { RefObject } from "react";

import type { Runtime } from "../runtime";

const RADIUS = 48;

/** Virtual joystick for touch screens (bottom start corner); writes rt.input.joy. */
export function Joystick({ rtRef }: { rtRef: RefObject<Runtime> }): ReactNode {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);

  const update = (clientX: number, clientY: number): void => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const rt = rtRef.current;
    rt.input.joy.x = dx / RADIUS;
    rt.input.joy.y = -dy / RADIUS;
  };
  const end = (): void => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    const rt = rtRef.current;
    rt.input.joy.x = 0;
    rt.input.joy.y = 0;
  };

  return (
    <div
      ref={base}
      data-game3d-joystick
      className="border-foreground/20 bg-background/40 absolute start-6 bottom-16 z-40 h-28 w-28 touch-none rounded-full border backdrop-blur-sm select-none"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        // Centred by the inline transform only: Tailwind's -translate-* use the separate
        // `translate` property, so combining both shifted the knob twice (off-centre).
        className="bg-foreground/60 absolute top-1/2 left-1/2 h-12 w-12 rounded-full shadow-md"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      />
    </div>
  );
}
