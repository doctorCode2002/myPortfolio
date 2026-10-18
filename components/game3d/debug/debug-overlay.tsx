"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";

import { AtmosphereDebug } from "../atmosphere/atmosphere-debug";
import { nearestInteractable, type GameWorld } from "../logic/world-layout";
import type { Runtime } from "../runtime";

type Snapshot = {
  fps: number;
  pos: string;
  hex: string;
  island: string;
  nearest: string;
  inRange: string;
  zoom: string;
  frozen: boolean;
};

/** Dev-only HUD (?debug=1): fps, player world/hex coordinates, island, nearest door/NPC. */
export function DebugOverlay({
  rtRef,
  world,
}: {
  rtRef: RefObject<Runtime>;
  world: GameWorld;
}): ReactNode {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const rt = rtRef.current;
      const p = rt.player.pos;
      let near = "";
      let best = Infinity;
      for (const it of world.interactables) {
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d < best) {
          best = d;
          near = `${it.kind}:${it.id} ${d.toFixed(1)}m`;
        }
      }
      const hit = nearestInteractable(world.interactables, p.x, p.y, p.z);
      setSnap({
        fps: rt.fps,
        pos: `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`,
        hex: rt.player.hex ? `${rt.player.hex.q}, ${rt.player.hex.r}` : "-",
        island:
          rt.player.islandId ??
          (rt.player.bridgeId ? `bridge ${rt.player.bridgeId}` : "-"),
        nearest: near || "-",
        inRange: hit ? hit.item.id : "-",
        zoom: `${rt.camera.zoom.toFixed(2)} yaw ${((rt.camera.yaw * 180) / Math.PI).toFixed(0)} pitch ${((rt.camera.pitch * 180) / Math.PI).toFixed(0)}`,
        frozen: rt.frozen,
      });
    }, 200);
    return () => clearInterval(id);
  }, [rtRef, world]);
  if (!snap) return null;
  return (
    <div
      data-game3d-debug
      className="pointer-events-none absolute end-3 top-20 z-40 rounded-md bg-black/70 px-3 py-2 font-mono text-[11px] leading-5 text-white sm:top-6"
    >
      <div>fps {snap.fps}</div>
      <div>pos {snap.pos}</div>
      <div>hex {snap.hex}</div>
      <div>island {snap.island}</div>
      <div>nearest {snap.nearest}</div>
      <div>in range {snap.inRange}</div>
      <div>cam {snap.zoom}</div>
      <div>frozen {String(snap.frozen)}</div>
      <AtmosphereDebug />
      <div className="pointer-events-auto mt-1 flex max-w-[15rem] flex-wrap gap-1">
        {world.islands.map((isl) => (
          <button
            key={isl.id}
            type="button"
            data-game3d-goto={isl.id}
            onClick={() => {
              rtRef.current.teleport = isl.id;
            }}
            className="cursor-pointer rounded bg-white/15 px-1.5 py-0.5 hover:bg-white/30"
          >
            {isl.id}
          </button>
        ))}
      </div>
    </div>
  );
}
