"use client";

import { useFrame, useThree } from "@react-three/fiber";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import * as THREE from "three";

import { assign, setUniform } from "../fx/assign";
import { sharedUniforms } from "../fx/shared-time";
import type { GameWorld } from "../logic/world-layout";
import { subscribeSound, soundEnabled } from "../audio/sound-store";
import { easeLive, live, setTarget, snapLive } from "./live";
import { AtmosphereParticles } from "./particles";
import { RainGround } from "./rain-ground";
import { atmosphere, setDebugHour, setTimeMode } from "./store";
import {
  blendAt,
  hourForMode,
  parseTimeParam,
  PRESET_HOUR,
} from "./time-of-day";
import {
  gustAt,
  parseWeatherParam,
  planWeather,
  rainAmount,
  type WeatherPlan,
} from "./weather";

/** The Web Audio system only loads once the visitor turns sound on. */
const LazyAudio = lazy(() => import("../audio/audio-system"));

/** Seconds for the look to settle after a change (time toggle, rain). */
const EASE_SECONDS = 1.8;

/** Reads ?time= and ?weather= once (dev and prod: they are harmless view options). */
let paramsRead = false;
function readParams(): void {
  if (typeof window === "undefined" || paramsRead) return;
  paramsRead = true;
  const q = new URLSearchParams(window.location.search);
  const time = parseTimeParam(q.get("time"));
  if (time && "mode" in time) setTimeMode(time.mode);
  else if (time) setDebugHour(time.hour);
  atmosphere.weatherOverride = parseWeatherParam(q.get("weather"));
}

/**
 * Drives the look of the world: the hour (local clock, a preset, or the debug slider),
 * the visit's weather and the wind, eased into the live look that the sky, lights,
 * clouds and fog read. Fog and exposure are set here.
 */
function AtmosphereDriver({ reducedMotion }: { reducedMotion: boolean }): null {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const ref = useRef({
    plan: null as WeatherPlan | null,
    first: true,
    clockHour: 18,
    clockTimer: 1e9,
  });
  useFrame(({ clock }, dt) => {
    const st = ref.current;
    readParams();
    if (!st.plan)
      st.plan = planWeather(Math.random, atmosphere.weatherOverride);
    // The local clock only needs reading now and then (no Date per frame).
    st.clockTimer += dt;
    if (st.clockTimer > 15) {
      st.clockTimer = 0;
      st.clockHour = hourForMode("auto", new Date());
    }
    const hour =
      atmosphere.debugHour ??
      (atmosphere.mode === "auto"
        ? st.clockHour
        : PRESET_HOUR[atmosphere.mode]);
    const t = clock.elapsedTime;
    const rain = rainAmount(st.plan, t);
    setTarget(blendAt(hour), rain);
    if (st.first) {
      snapLive();
      st.first = false;
    } else easeLive(1 - Math.exp(-Math.min(dt, 0.1) / (EASE_SECONDS / 3)));
    const gust = reducedMotion ? 0 : gustAt(t, rain);

    atmosphere.hour = hour;
    atmosphere.rain = rain;
    atmosphere.gust = gust;
    atmosphere.night = live.night;
    atmosphere.daylight = Math.max(0, 1 - live.night * 1.3);
    setUniform(sharedUniforms.uNight, live.night);
    setUniform(sharedUniforms.uRain, rain);
    setUniform(sharedUniforms.uGust, gust);

    const fog = scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.copy(live.fog);
      assign(fog, "near", live.fogNear);
      assign(fog, "far", live.fogFar);
    }
    assign(gl, "toneMappingExposure", live.exposure);
  });
  return null;
}

function useSoundOn(): boolean {
  return useSyncExternalStore(subscribeSound, soundEnabled, () => false);
}

/**
 * Day/night, weather, seasonal particles and (once enabled) ambient sound. Mounted once
 * inside the World3D scene.
 */
export function Atmosphere({
  world,
  phone,
  reducedMotion,
}: {
  world: GameWorld;
  phone: boolean;
  reducedMotion: boolean;
}): ReactNode {
  useEffect(() => {
    readParams();
    if (process.env.NODE_ENV === "production") return;
    // Dev: the atmosphere state and setters for automated checks.
    const w = window as unknown as { __atmosphere?: unknown };
    w.__atmosphere = { state: atmosphere, setTimeMode, setDebugHour };
    return () => {
      delete w.__atmosphere;
    };
  }, []);
  const sound = useSoundOn();
  return (
    <>
      <AtmosphereDriver reducedMotion={reducedMotion} />
      <AtmosphereParticles
        world={world}
        phone={phone}
        reducedMotion={reducedMotion}
      />
      <RainGround world={world} phone={phone} reducedMotion={reducedMotion} />
      {sound && (
        <Suspense fallback={null}>
          <LazyAudio world={world} />
        </Suspense>
      )}
    </>
  );
}
