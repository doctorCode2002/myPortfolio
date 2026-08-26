"use client";

import { RotateCcw } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { STACK_CHIPS, type StackChip } from "@/lib/content/about";
import { useReducedMotion } from "@/lib/motion";

const CHIP_RADIUS = 14;
const ICON_RADIUS = 10;
const WALL_PAD = 16;

type ChipState = {
  chip: StackChip;
  body: Matter.Body;
  width: number;
  height: number;
};

export function Stack({ dict }: { dict: Dictionary }): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [resetKey, setResetKey] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    // Falling, draggable chips are exactly the kind of motion prefers-reduced-motion
    // asks us to drop. The static list below renders instead — and matter-js is
    // never even fetched.
    if (reduced) return;

    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const Matter = await import("matter-js");
      if (cancelled) return;

      const { Engine, Runner, World, Bodies, Body, Mouse, MouseConstraint, Events } =
        Matter;

      const dims = (Array.from(measure.children) as HTMLElement[]).map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.max(80, r.width), h: Math.max(28, r.height) };
      });

      let width = container.clientWidth;
      let height = container.clientHeight;

      const engine = Engine.create();
      engine.gravity.y = 1;
      const world = engine.world;

      const wallThickness = 400;
      const floor = Bodies.rectangle(
        width / 2,
        height - WALL_PAD + wallThickness / 2,
        width * 3,
        wallThickness,
        { isStatic: true }
      );
      const leftWall = Bodies.rectangle(
        WALL_PAD - wallThickness / 2,
        height / 2,
        wallThickness,
        height * 4,
        { isStatic: true }
      );
      const rightWall = Bodies.rectangle(
        width - WALL_PAD + wallThickness / 2,
        height / 2,
        wallThickness,
        height * 4,
        { isStatic: true }
      );
      World.add(world, [floor, leftWall, rightWall]);

      const states: ChipState[] = STACK_CHIPS.map((chip, i) => {
        const dim = dims[i] ?? { w: 120, h: 36 };
        const halfW = dim.w / 2;
        const minX = WALL_PAD + halfW + 4;
        const maxX = width - WALL_PAD - halfW - 4;
        const x = minX + Math.random() * Math.max(1, maxX - minX);
        const y = -80 - i * 60 - Math.random() * 120;
        const body = Bodies.rectangle(x, y, dim.w, dim.h, {
          chamfer: { radius: CHIP_RADIUS },
          restitution: 0.35,
          friction: 0.5,
          frictionAir: 0.025,
          density: 0.0018,
          angle: (Math.random() - 0.5) * 0.4,
        });
        World.add(world, body);
        return { chip, body, width: dim.w, height: dim.h };
      });

      const mouse = Mouse.create(container);

      // Matter binds its own wheel handlers to the element, which hijacks page
      // scrolling over the widget. Remove them.
      const wheelTarget = mouse.element as HTMLElement & {
        mousewheel?: EventListener;
      };
      if (wheelTarget.mousewheel) {
        wheelTarget.removeEventListener("wheel", wheelTarget.mousewheel);
        wheelTarget.removeEventListener("DOMMouseScroll", wheelTarget.mousewheel);
      }

      const mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.2, damping: 0.2, render: { visible: false } },
      });
      World.add(world, mouseConstraint);

      Events.on(mouseConstraint, "startdrag", () => {
        container.style.cursor = "grabbing";
      });
      Events.on(mouseConstraint, "enddrag", () => {
        container.style.cursor = "grab";
      });

      const runner = Runner.create();
      Runner.run(runner, engine);

      let raf = 0;
      const tick = (): void => {
        for (let i = 0; i < states.length; i++) {
          const s = states[i];
          const el = chipRefs.current[i];
          if (!s || !el) continue;
          const { x, y } = s.body.position;
          el.style.transform = `translate3d(${x - s.width / 2}px, ${y - s.height / 2}px, 0) rotate(${s.body.angle}rad)`;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      const onResize = (): void => {
        const newW = container.clientWidth;
        const newH = container.clientHeight;
        if (newW === width && newH === height) return;
        Body.setPosition(floor, {
          x: newW / 2,
          y: newH - WALL_PAD + wallThickness / 2,
        });
        Body.setPosition(leftWall, {
          x: WALL_PAD - wallThickness / 2,
          y: newH / 2,
        });
        Body.setPosition(rightWall, {
          x: newW - WALL_PAD + wallThickness / 2,
          y: newH / 2,
        });
        width = newW;
        height = newH;
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(container);

      cleanup = (): void => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        Runner.stop(runner);
        World.clear(world, false);
        Engine.clear(engine);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [resetKey, reduced]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[15px] font-semibold text-foreground">
          {dict.aboutPage.stackHeading}
        </h2>
        {!reduced && (
          <p className="text-[13px] text-muted-foreground">
            {dict.aboutPage.stackHint}
          </p>
        )}
      </div>

      {reduced ? (
        <div className="rounded-4xl border border-foreground/10 bg-muted/50 p-4">
          <ul className="flex flex-wrap gap-2">
            {STACK_CHIPS.map((chip) => (
              <li key={chip.id}>
                <ChipPill chip={chip} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="relative h-40 overflow-hidden rounded-4xl border border-foreground/10 bg-muted/50 sm:h-64">
          <button
            type="button"
            onClick={() => setResetKey((k) => k + 1)}
            aria-label={dict.aboutPage.stackReset}
            className="focus-ring absolute end-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/10 bg-background text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          </button>

          {/* Off-screen copy measured once to size the physics bodies. */}
          <div
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute start-0 top-0 flex flex-wrap gap-2"
          >
            {STACK_CHIPS.map((chip) => (
              <ChipPill key={`m-${chip.id}`} chip={chip} />
            ))}
          </div>

          <div
            ref={containerRef}
            className="absolute inset-0 cursor-grab select-none"
            style={{ touchAction: "none" }}
          >
            {STACK_CHIPS.map((chip, i) => (
              <div
                key={`${resetKey}-${chip.id}`}
                ref={(el) => {
                  chipRefs.current[i] = el;
                }}
                className="pointer-events-none absolute start-0 top-0 will-change-transform"
                style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
              >
                <ChipPill chip={chip} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChipPill({ chip }: { chip: StackChip }): ReactNode {
  return (
    <div
      dir="ltr"
      className="inline-flex items-center gap-2 p-1 pe-2 text-[15px] font-medium sm:text-[16px] dark:ring-1 dark:ring-white/15"
      style={{
        backgroundColor: chip.bg,
        color: chip.fg,
        borderRadius: `${CHIP_RADIUS}px`,
      }}
    >
      <span
        className="inline-flex h-8 w-8 items-center justify-center bg-white/95"
        style={{ borderRadius: `${ICON_RADIUS}px` }}
        aria-hidden="true"
      >
        <Image
          src={chip.icon}
          alt=""
          width={20}
          height={20}
          unoptimized
          className="h-5 w-5"
          draggable={false}
        />
      </span>
      <span>{chip.label}</span>
    </div>
  );
}
