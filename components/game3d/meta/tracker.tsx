"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { gameEvents } from "@/components/game/engine/events";
import { atmosphere } from "../atmosphere/store";
import { nearestStandable } from "../logic/collision";
import { PLAYER_RADIUS_HEX, type GameWorld } from "../logic/world-layout";
import { onFoot, useRuntimeRef } from "../runtime";
import { setGoldCloak, setGoldPaint } from "./gold";
import { placeFires } from "./placement";
import { crossedBridge } from "./progress";
import {
  addSmashes,
  liveProgress,
  liveUi,
  MAYOR_ISLAND,
  markBridge,
  markMayorMet,
  markTour,
  markVisited,
  markWeather,
  metaRequests,
  rewardsUnlocked,
  setTravelPhase,
} from "./store";

/** Fast travel timing (ms): fade to the sky, move, hold, fade back. */
const FADE_OUT = 420;
const HOLD = 380;
const FADE_IN = 480;
/** Seconds of night (or rain) before it counts. */
const NIGHT_SECONDS = 8;
const RAIN_SECONDS = 3;

/**
 * Watches the game for passport progress (islands visited, mayors met, tours accepted,
 * bridges driven end to end, props smashed, night and rain), runs fast travel between lit
 * signal fires, and applies the golden rewards to the car and the player.
 */
export function MetaTracker({ world }: { world: GameWorld }): ReactNode {
  const rtRef = useRuntimeRef();
  const scene = useThree((s) => s.scene);
  const fires = useMemo(() => placeFires(world), [world]);
  const st = useRef({
    frame: 0,
    lastIsland: null as string | null,
    bridge: null as string | null,
    bridgeFrom: null as string | null,
    knownBroken: new Set<string>(),
    breakVersion: -1,
    night: 0,
    rain: 0,
    travel: null as null | { to: string; start: number; moved: boolean },
    car: null as THREE.Object3D | null,
    carGold: false,
    player: null as THREE.Object3D | null,
    playerGold: false,
  });

  // Mayors met and tours taken come from the dialogue events.
  useEffect(() => {
    const offNpc = gameEvents.on("interact:npc", ({ npcId }) => {
      const island = MAYOR_ISLAND[npcId];
      if (island) markMayorMet(island);
    });
    const offTour = gameEvents.on("tour:answer", ({ npcId, accept }) => {
      const island = MAYOR_ISLAND[npcId];
      if (island && accept) markTour(island);
    });
    return () => {
      offNpc();
      offTour();
    };
  }, []);

  useFrame((_, rawDt) => {
    const rt = rtRef.current;
    const s = st.current;
    const now = performance.now();

    // Fast travel (runs every frame while active).
    const req = metaRequests.travel;
    if (req && !s.travel) {
      metaRequests.travel = null;
      if (
        onFoot(rt) &&
        liveProgress().fires.includes(req) &&
        fires.some((f) => f.islandId === req)
      ) {
        s.travel = { to: req, start: now, moved: false };
        gameEvents.lockUi("travel");
        setTravelPhase("out", req);
      }
    }
    const tr = s.travel;
    if (tr) {
      const e = now - tr.start;
      if (!tr.moved && e >= FADE_OUT) {
        tr.moved = true;
        const fire = fires.find((f) => f.islandId === tr.to);
        const island = world.islands.find((i) => i.id === tr.to);
        if (fire && island) {
          // Stand a step from the fire, toward the island's middle, facing the fire.
          const dx = island.center[0] - fire.x;
          const dz = island.center[1] - fire.z;
          const d = Math.hypot(dx, dz) || 1;
          const radius = PLAYER_RADIUS_HEX * world.hexWidth;
          const spot = nearestStandable(
            world.walk,
            fire.x + (dx / d) * 1.2,
            fire.z + (dz / d) * 1.2,
            radius
          );
          if (spot) {
            rt.player.pos.x = spot.x;
            rt.player.pos.y = spot.surface.y;
            rt.player.pos.z = spot.z;
            rt.player.heading = Math.atan2(fire.x - spot.x, fire.z - spot.z);
            rt.player.islandId = tr.to;
            rt.spawnIsland = tr.to;
            rt.path = null;
            rt.target = null;
          }
        }
      } else if (
        tr.moved &&
        e >= FADE_OUT + HOLD &&
        liveUi().travel.phase === "out"
      ) {
        setTravelPhase("in", tr.to);
      } else if (e >= FADE_OUT + HOLD + FADE_IN) {
        s.travel = null;
        setTravelPhase("idle", null);
        gameEvents.unlockUi("travel");
      }
    }

    // Everything else a few times a second.
    s.frame = (s.frame + 1) % 8;
    if (s.frame !== 0) return;
    const dt = Math.min(rawDt, 0.05) * 8;

    // Islands visited (on foot or by car).
    const island = rt.player.islandId;
    if (island && rt.placed) markVisited(island);

    // Bridges driven end to end.
    const car = rt.car.state;
    if (rt.car.driving && car) {
      if (car.bridgeId && !s.bridge) {
        s.bridge = car.bridgeId;
        s.bridgeFrom = s.lastIsland;
      } else if (!car.bridgeId && s.bridge && car.islandId) {
        const b = world.walk.bridges.find((x) => x.id === s.bridge);
        if (b && crossedBridge(b, s.bridgeFrom, car.islandId)) markBridge(b.id);
        s.bridge = null;
      }
      if (car.islandId && !car.bridgeId) s.lastIsland = car.islandId;
    } else {
      s.bridge = null;
      if (island) s.lastIsland = island;
    }

    // Props smashed: keys newly in the broken map.
    const props = rt.props;
    if (props.version !== s.breakVersion) {
      s.breakVersion = props.version;
      let fresh = 0;
      for (const key of props.broken.keys())
        if (!s.knownBroken.has(key)) {
          s.knownBroken.add(key);
          fresh++;
        }
      for (const key of s.knownBroken)
        if (!props.broken.has(key)) s.knownBroken.delete(key);
      addSmashes(fresh);
    }

    // Night owl and caught in the rain.
    const p = liveProgress();
    if (!p.night) {
      s.night = atmosphere.night > 0.6 ? s.night + dt : 0;
      if (s.night > NIGHT_SECONDS) markWeather("night");
    }
    if (!p.rain) {
      s.rain = atmosphere.rain > 0.35 && rt.placed ? s.rain + dt : 0;
      if (s.rain > RAIN_SECONDS) markWeather("rain");
    }

    // The golden rewards on the car and the player's cloak.
    const unlocked = rewardsUnlocked();
    if (!s.car || !s.car.parent) s.car = scene.getObjectByName("car") ?? null;
    const wantCar = unlocked && p.settings.goldCar;
    if (s.car && (wantCar !== s.carGold || wantCar)) {
      // Re-applied while on: the car model swaps in when it finishes loading.
      setGoldPaint(s.car, wantCar);
      s.carGold = wantCar;
    }
    if (!s.player || !s.player.parent)
      s.player = scene.getObjectByName("player") ?? null;
    const wantCloak = unlocked && p.settings.goldCloak;
    if (s.player && (wantCloak !== s.playerGold || wantCloak)) {
      setGoldCloak(s.player, wantCloak);
      s.playerGold = wantCloak;
    }
  });

  return null;
}
