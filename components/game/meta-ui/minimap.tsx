"use client";

import { ChevronDown, Map as MapIcon } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { GameWorld } from "@/components/game3d/logic/world-layout";
import { buildMapData, placeFires } from "@/components/game3d/meta/placement";
import type { Progress } from "@/components/game3d/meta/progress";
import {
  requestTravel,
  setMinimapOpen,
  setTarget,
  type MetaUi,
} from "@/components/game3d/meta/store";
import type { Runtime } from "@/components/game3d/runtime";
import { ISLAND_INK } from "./passport";
import { islandName } from "./strings";

/** An island name without the word "Island" ("Khidmty Island" -> "Khidmty"). */
function shortName(name: string): string {
  return name.replace(/\s*(Island|جزيرة)\s*/g, " ").trim() || name;
}

const PAD = 6;

/**
 * The round minimap: island footprints, bridges, lit signal fires, the car and the player
 * (position and heading, updated without React renders). Choose an island to make it the
 * compass target; a lit fire there can be travelled to (not while driving).
 */
export function Minimap({
  rtRef,
  world,
  dict,
  progress,
  ui,
  touch,
  rtl,
  driving,
}: {
  rtRef: RefObject<Runtime>;
  world: GameWorld;
  dict: Dictionary;
  progress: Progress;
  ui: MetaUi;
  touch: boolean;
  rtl: boolean;
  /** The player is in the car (no fast travel). */
  driving: boolean;
}): ReactNode {
  const t = dict.play.meta;
  const map = useMemo(() => buildMapData(world), [world]);
  const fires = useMemo(() => placeFires(world), [world]);
  const player = useRef<SVGGElement>(null);
  const car = useRef<SVGGElement>(null);
  const carShown = useRef<boolean | null>(null);
  const cx = (map.minX + map.maxX) / 2;
  const cz = (map.minZ + map.maxZ) / 2;
  const half = Math.max(map.maxX - map.minX, map.maxZ - map.minZ) / 2 + PAD;
  const open = ui.minimapOpen;

  // Player and car markers follow the runtime (about 30 times a second).
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let n = 0;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      n = (n + 1) % 2;
      if (n) return;
      const rt = rtRef.current;
      const p = rt.player.pos;
      const deg = (-rt.player.heading * 180) / Math.PI + 180;
      player.current?.setAttribute(
        "transform",
        `translate(${p.x.toFixed(2)} ${p.z.toFixed(2)}) rotate(${deg.toFixed(1)})`
      );
      const c = rt.car.state;
      if (car.current && c) {
        car.current.setAttribute(
          "transform",
          `translate(${c.x.toFixed(2)} ${c.z.toFixed(2)}) rotate(${((-c.heading * 180) / Math.PI).toFixed(1)})`
        );
        const shown = !rt.car.driving;
        if (carShown.current !== shown) {
          carShown.current = shown;
          car.current.style.display = shown ? "" : "none";
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, rtRef]);

  const target = ui.target;
  const targetLit = target ? progress.fires.includes(target) : false;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setMinimapOpen(true)}
        aria-label={t.mapShow}
        title={t.mapShow}
        className="focus-ring border-foreground/15 bg-background/85 text-foreground pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border shadow-sm backdrop-blur-md"
      >
        <MapIcon aria-hidden className="h-5 w-5" />
      </button>
    );
  }

  const select = (id: string): void => setTarget(target === id ? null : id);
  const size = touch ? 150 : 176;

  return (
    <div
      className="pointer-events-auto flex flex-col items-start gap-2"
      dir={rtl ? "rtl" : "ltr"}
    >
      {target && (
        <div
          className="border-foreground/15 bg-background/90 text-foreground flex max-w-[15rem] flex-col gap-1.5 rounded-xl border p-2.5 text-xs shadow-sm backdrop-blur-md"
          aria-live="polite"
        >
          <span className="text-muted-foreground text-[11px]">{t.target}</span>
          <span className="font-semibold">{islandName(dict, target)}</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!targetLit || driving}
              onClick={() => requestTravel(target)}
              className="focus-ring bg-accent text-accent-foreground cursor-pointer rounded-full px-2.5 py-1 font-semibold disabled:cursor-default disabled:opacity-40"
              aria-describedby="minimap-travel-why"
            >
              {t.travel}
            </button>
            <button
              type="button"
              onClick={() => setTarget(null)}
              className="focus-ring border-foreground/15 hover:bg-muted cursor-pointer rounded-full border px-2.5 py-1"
            >
              {t.clearTarget}
            </button>
          </div>
          {(!targetLit || driving) && (
            <span
              id="minimap-travel-why"
              className="text-muted-foreground text-[11px]"
            >
              {!targetLit ? t.travelNeedsFire : t.travelNotDriving}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <svg
          role="group"
          aria-label={t.mapLabel}
          width={size}
          height={size}
          viewBox={`${cx - half} ${cz - half} ${half * 2} ${half * 2}`}
          className="border-foreground/20 rounded-full border-2 bg-[#bcd3e6]/85 shadow-md backdrop-blur-md"
          style={{ clipPath: "circle(50%)" }}
        >
          {map.bridges.map((b) => (
            <line
              key={b.id}
              x1={b.ax}
              y1={b.az}
              x2={b.bx}
              y2={b.bz}
              stroke="#8a6a48"
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          ))}
          {map.islands.map((i) => {
            const visited = progress.visited.includes(i.islandId);
            const name = islandName(dict, i.islandId);
            const label = visited ? name : `${name} (${t.unvisited})`;
            const selected = target === i.islandId;
            return (
              <g
                key={i.islandId}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                className="cursor-pointer outline-none focus-visible:[&>path]:stroke-[#fff]"
                onClick={() => select(i.islandId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(i.islandId);
                  }
                }}
              >
                <title>{label}</title>
                <path
                  d={i.d}
                  fill={
                    visited ? (ISLAND_INK[i.islandId] ?? "#6b8f4a") : "#9aa39a"
                  }
                  fillOpacity={visited ? 0.9 : 0.75}
                  stroke={selected ? "#fff6c9" : "none"}
                  strokeWidth={selected ? 1.6 : 0}
                />
                <text
                  x={i.cx}
                  y={i.cz + 1.5}
                  textAnchor="middle"
                  fontSize={4.6}
                  fontWeight={700}
                  fill={visited ? "#fffdf2" : "#e8ece8"}
                  stroke="#1f2a44"
                  strokeOpacity={0.55}
                  strokeWidth={0.9}
                  paintOrder="stroke"
                  pointerEvents="none"
                  aria-hidden
                >
                  {shortName(name)}
                  {visited ? "" : " ?"}
                </text>
              </g>
            );
          })}
          {fires
            .filter((f) => progress.fires.includes(f.islandId))
            .map((f) => (
              <circle
                key={f.id}
                cx={f.x}
                cy={f.z}
                r={1.6}
                fill="#ffb347"
                stroke="#7a3d00"
                strokeWidth={0.5}
              />
            ))}
          {target &&
            (() => {
              const i = map.islands.find((x) => x.islandId === target);
              return i ? (
                <circle
                  cx={i.cx}
                  cy={i.cz}
                  r={half * 0.16}
                  fill="none"
                  stroke="#fff6c9"
                  strokeWidth={1.2}
                  strokeDasharray="2.5 2"
                  pointerEvents="none"
                />
              ) : null;
            })()}
          <g ref={car} pointerEvents="none">
            <rect
              x={-1.2}
              y={-2}
              width={2.4}
              height={4}
              rx={0.7}
              fill="#e2643b"
              stroke="#fff"
              strokeWidth={0.5}
            />
          </g>
          <g ref={player} pointerEvents="none" aria-label={t.youAreHere}>
            <circle r={2.6} fill="#fff" fillOpacity={0.35} />
            <path
              d="M0 -3.4 L2.4 2.6 L0 1.3 L-2.4 2.6 Z"
              fill="#1f2a44"
              stroke="#fff"
              strokeWidth={0.6}
            />
          </g>
        </svg>
        <button
          type="button"
          onClick={() => setMinimapOpen(false)}
          aria-label={t.mapHide}
          title={t.mapHide}
          className="focus-ring border-foreground/15 bg-background/90 text-foreground absolute -end-1 -top-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border shadow-sm"
        >
          <ChevronDown aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
