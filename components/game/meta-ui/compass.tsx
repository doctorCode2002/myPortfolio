"use client";

import { Gem, MapPin } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { GameWorld } from "@/components/game3d/logic/world-layout";
import {
  nearest,
  placeShards,
  relativeBearing,
} from "@/components/game3d/meta/placement";
import type { Progress } from "@/components/game3d/meta/progress";
import type { Runtime } from "@/components/game3d/runtime";
import { ISLAND_INK } from "./passport";
import { islandName } from "./strings";

/** The strip shows this much of the view either side of straight ahead. */
const HALF_FOV = (100 * Math.PI) / 180;
/** Markers stay this far (px) inside the strip's ends. */
const EDGE = 12;

type Mark = { el: HTMLElement | null; x: number; z: number; dir?: boolean };

/**
 * A compass ring along the top: the cardinal points, the nearest unfound sky shard (a
 * setting) and the minimap target island, placed by their bearing from the camera's view.
 * Markers past the edge stick to it. Updated without React renders.
 */
export function Compass({
  rtRef,
  world,
  dict,
  progress,
  target,
  rtl,
}: {
  rtRef: RefObject<Runtime>;
  world: GameWorld;
  dict: Dictionary;
  progress: Progress;
  target: string | null;
  rtl: boolean;
}): ReactNode {
  const t = dict.play.meta;
  const shards = useMemo(() => placeShards(world), [world]);
  const strip = useRef<HTMLDivElement>(null);
  const cardinals = useRef<(HTMLSpanElement | null)[]>([]);
  const shardEl = useRef<HTMLSpanElement>(null);
  const targetEl = useRef<HTMLSpanElement>(null);
  const found = useRef<readonly string[]>(progress.shards);
  useEffect(() => {
    found.current = progress.shards;
  }, [progress.shards]);
  const showShards = progress.settings.compassShards;
  const targetIsland = target
    ? world.islands.find((i) => i.id === target)
    : undefined;

  useEffect(() => {
    let raf = 0;
    let n = 0;
    // North is -z (screen up at the default camera yaw).
    const cards: Mark[] = [
      { el: null, x: 0, z: -1, dir: true },
      { el: null, x: 1, z: 0, dir: true },
      { el: null, x: 0, z: 1, dir: true },
      { el: null, x: -1, z: 0, dir: true },
    ];
    const place = (
      el: HTMLElement | null,
      bearing: number,
      w: number,
      clamp: boolean
    ): void => {
      if (!el) return;
      const k = bearing / HALF_FOV;
      if (!clamp && Math.abs(k) > 1) {
        el.style.opacity = "0";
        return;
      }
      const c = Math.max(-1, Math.min(1, k));
      el.style.opacity = Math.abs(k) > 1 ? "0.65" : "1";
      el.style.transform = `translateX(${(c * (w / 2 - EDGE)).toFixed(1)}px) translateX(-50%)`;
    };
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      n = (n + 1) % 2;
      if (n) return;
      const rt = rtRef.current;
      const w = strip.current?.clientWidth ?? 240;
      const yaw = rt.camera.yaw;
      cards.forEach((c, i) => {
        place(
          cardinals.current[i] ?? null,
          relativeBearing(c.x, c.z, yaw),
          w,
          false
        );
      });
      const p = rt.player.pos;
      if (shardEl.current) {
        const s = nearest(shards, p.x, p.z, (x) =>
          found.current.includes(x.id)
        );
        if (s) {
          shardEl.current.style.display = "";
          place(
            shardEl.current,
            relativeBearing(s.x - p.x, s.z - p.z, yaw),
            w,
            true
          );
        } else shardEl.current.style.display = "none";
      }
      if (targetEl.current && targetIsland) {
        place(
          targetEl.current,
          relativeBearing(
            targetIsland.center[0] - p.x,
            targetIsland.center[1] - p.z,
            yaw
          ),
          w,
          true
        );
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rtRef, shards, targetIsland]);

  const letters = [t.north, t.east, t.south, t.west];
  const allFound = progress.shards.length >= shards.length;

  return (
    <div
      className="pointer-events-none flex flex-col items-center"
      dir="ltr"
      role="group"
      aria-label={t.compass}
    >
      <div
        ref={strip}
        aria-hidden
        className="border-foreground/15 bg-background/75 relative h-8 w-[min(16rem,46vw)] overflow-hidden rounded-full border shadow-sm backdrop-blur-md"
      >
        {/* Ticks */}
        <div className="bg-foreground/50 absolute top-0 left-1/2 h-2 w-0.5 -translate-x-1/2" />
        {letters.map((l, i) => (
          <span
            key={i}
            ref={(el) => {
              cardinals.current[i] = el;
            }}
            className={`absolute top-1/2 left-1/2 -mt-2 text-xs leading-4 font-bold ${i === 0 ? "text-[#c0392b]" : "text-foreground/80"}`}
          >
            {l}
          </span>
        ))}
        {showShards && !allFound && (
          <span
            ref={shardEl}
            className="absolute top-1/2 left-1/2 -mt-2.5 text-[#1b9fd1]"
          >
            <Gem className="h-5 w-5 drop-shadow" />
          </span>
        )}
        {targetIsland && (
          <span
            ref={targetEl}
            className="absolute top-1/2 left-1/2 -mt-2.5"
            style={{ color: ISLAND_INK[targetIsland.id] ?? "#333" }}
          >
            <MapPin className="h-5 w-5 drop-shadow" />
          </span>
        )}
      </div>
      <p className="sr-only" aria-live="polite" dir={rtl ? "rtl" : "ltr"}>
        {target ? `${t.target}: ${islandName(dict, target)}` : ""}
      </p>
    </div>
  );
}
