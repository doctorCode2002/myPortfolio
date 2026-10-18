"use client";

import {
  AdaptiveDpr,
  PerformanceMonitor,
  useProgress,
} from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { gameEvents } from "@/components/game/engine/events";
import { ISLANDS_3D } from "@/content/islands3d";
import { BRIDGES, ISLANDS, RESIDENTS } from "@/lib/content/world";
import { progressSigns } from "@/lib/content/world.panels";
import { getMayorDialogue } from "@/lib/content/world.selectors";
import { isRtl, type Locale } from "@/lib/i18n";
import { fetchManifest, fetchModelBounds } from "./assets/manifest";
import type { ModelBounds } from "./logic/glb-bounds";
import { FollowCamera } from "./camera/follow-camera";
import { DebugOverlay } from "./debug/debug-overlay";
import { WalkGridViz } from "./debug/walk-grid-viz";
import { BridgeView } from "./entities/bridge-view";
import { Interactions, type PromptLabels } from "./entities/interactions";
import { Mayor } from "./entities/mayor";
import { buildStoryLabels } from "./story/labels";
import { StoryLayer } from "./story/story-layer";
import { Player } from "./entities/player";
import { TargetMarker } from "./entities/target-marker";
import { IslandView } from "./island/island-view";
import type { Manifest } from "./logic/types";
import {
  buildGameWorld,
  modelsNeedingBounds,
  type GameWorld,
  type MayorInfo,
} from "./logic/world-layout";
import * as carLogic from "./logic/car";
import { createRuntime, RuntimeContext, type Runtime } from "./runtime";
import { Atmosphere } from "./atmosphere/atmosphere";
import { Birds } from "./scene/birds";
import { ShaderClock } from "./scene/clock";
import { Clouds } from "./scene/clouds";
import { Lights } from "./scene/lights";
import { SKY, SkyDome } from "./scene/sky";
import { DriveHud } from "./ui/drive-hud";
import { Joystick } from "./ui/joystick";
import { CarSystem } from "./vehicle/car-system";
import { GlideHud } from "./movement/glide-hud";
import {
  MovementSystem,
  type MovementLabels,
} from "./movement/movement-system";
import { GuestbookStone } from "./social/guestbook-stone";
import { GUESTBOOK_STONE_ID } from "./social/stone-layout";
import { VisitorGhosts } from "./social/visitor-ghosts";
import { WorkshopLife } from "./workshop/workshop-life";
import { MetaHud } from "@/components/game/meta-ui/meta-hud";
import { MetaLayer } from "./meta/meta-layer";
import { BalloonHud, type BalloonHudLabels } from "./balloon/balloon-hud";
import {
  BalloonSystem,
  type BalloonPromptLabels,
} from "./balloon/balloon-system";
import type { FireLabels } from "./meta/fires";

const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
]);

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

const MAYORS: Record<string, MayorInfo | undefined> = Object.fromEntries(
  ISLANDS.map((i) => [
    i.id,
    i.mayor ? { id: i.mayor.id, sprite: i.mayor.sprite } : undefined,
  ])
);

function buildLabels(dict: Dictionary, locale: Locale): PromptLabels {
  const raw = dict as unknown as Record<string, unknown>;
  const buildings = (dict.world.buildings ?? {}) as Record<
    string,
    { sign?: string }
  >;
  const signs: Record<string, string> = {};
  for (const [id, entry] of Object.entries(buildings))
    if (entry?.sign) signs[id] = entry.sign;
  Object.assign(signs, progressSigns(locale));
  signs[GUESTBOOK_STONE_ID] = dict.play.social.stoneSign;
  const npcNames: Record<string, string> = {};
  for (const island of ISLANDS) {
    if (island.mayor)
      npcNames[island.mayor.id] = getMayorDialogue(island.mayor, raw).name;
  }
  for (const res of RESIDENTS)
    npcNames[res.id] = getMayorDialogue(res, raw).name;
  return {
    signs,
    npcNames,
    talk: dict.play.talk,
    tap: dict.play.tap,
    drive: dict.play.drive,
    rtl: isRtl(locale),
    story: buildStoryLabels(dict),
  };
}

/** Keyboard state and UI freezing (game:freeze / ui locks from the React overlays). */
function useInputAndFreeze(rtRef: RefObject<Runtime>): void {
  useEffect(() => {
    const rt = rtRef.current;
    const clear = (): void => {
      rt.input.keys.clear();
      rt.input.joy.x = 0;
      rt.input.joy.y = 0;
    };
    const setFrozen = (frozen: boolean): void => {
      if (rt.frozen && !frozen) rt.unfrozenAt = performance.now();
      rt.frozen = frozen;
      if (frozen) {
        clear();
        rt.path = null;
        rt.target = null;
      }
    };
    setFrozen(gameEvents.isUiLocked());
    const offFreeze = gameEvents.on("game:freeze", (f) =>
      setFrozen(Boolean(f))
    );
    const offClose = gameEvents.on("ui:close", () => setFrozen(false));
    const typing = (e: KeyboardEvent): boolean => {
      const t = e.target as HTMLElement | null;
      return Boolean(
        t && (/input|textarea|select/i.test(t.tagName) || t.isContentEditable)
      );
    };
    const down = (e: KeyboardEvent): void => {
      if (typing(e) || !MOVE_KEYS.has(e.code)) return;
      if (rt.frozen) return;
      if (e.code.startsWith("Arrow")) e.preventDefault();
      rt.input.keys.add(e.code);
    };
    const up = (e: KeyboardEvent): void => {
      rt.input.keys.delete(e.code);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      offFreeze();
      offClose();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [rtRef]);
}

/** Dev only: the renderer and scene for automated checks (draw calls, timings). */
function ExposeThree(): null {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const w = window as unknown as { __three?: unknown };
    w.__three = { gl, scene };
    return () => {
      delete w.__three;
    };
  }, [gl, scene]);
  return null;
}

function Scene({
  world,
  manifest,
  charId,
  labels,
  touch,
  debug,
  shadowSize,
  reducedMotion,
  visitorLabel,
  moveLabels,
  metaLabels,
  balloonLabels,
}: {
  world: GameWorld;
  manifest: Manifest | null;
  charId: string;
  labels: PromptLabels;
  touch: boolean;
  debug: boolean;
  shadowSize: number;
  reducedMotion: boolean;
  visitorLabel: string;
  moveLabels: MovementLabels;
  metaLabels: FireLabels;
  balloonLabels: BalloonPromptLabels;
}): ReactNode {
  const center = useMemo(() => {
    const n = world.islands.length || 1;
    return {
      x: world.islands.reduce((s, i) => s + i.center[0], 0) / n,
      z: world.islands.reduce((s, i) => s + i.center[1], 0) / n,
    };
  }, [world]);
  return (
    <>
      <ShaderClock />
      <SkyDome reducedMotion={reducedMotion} />
      <fog attach="fog" args={[SKY.fog, 24, 110]} />
      <Lights shadowMapSize={shadowSize} />
      {world.islands.map((island) => {
        const grid = world.walk.islands.find((g) => g.islandId === island.id);
        return grid ? (
          <IslandView
            key={island.id}
            island={island}
            grid={grid}
            manifest={manifest}
          />
        ) : null;
      })}
      {world.walk.bridges.map((b) => (
        <BridgeView key={b.id} bridge={b} hexWidth={world.hexWidth} />
      ))}
      {world.interactables
        .filter((i) => i.kind === "npc")
        .map((npc) => {
          const island = world.islands.find((i) => i.id === npc.islandId);
          const rot =
            island?.residents?.find((r) => r.id === npc.id)?.rot ??
            island?.spawns?.mayor?.rot;
          const rest =
            rot !== undefined
              ? (rot * Math.PI) / 180
              : Math.atan2(
                  (island?.center[0] ?? npc.x) - npc.x,
                  (island?.center[1] ?? npc.z) - npc.z
                );
          return (
            <Mayor
              key={npc.id}
              npc={npc}
              manifest={manifest}
              restHeading={rest}
              world={world}
              labels={labels}
            />
          );
        })}
      <CarSystem world={world} manifest={manifest} />
      <WorkshopLife world={world} manifest={manifest} />
      <MovementSystem
        world={world}
        labels={moveLabels}
        touch={touch}
        reducedMotion={reducedMotion}
      />
      <BalloonSystem
        world={world}
        manifest={manifest}
        labels={balloonLabels}
        touch={touch}
        reducedMotion={reducedMotion}
      />
      <Player world={world} manifest={manifest} charId={charId} />
      <GuestbookStone world={world} />
      <VisitorGhosts
        manifest={manifest}
        charId={charId}
        reducedMotion={reducedMotion}
        label={visitorLabel}
        rtl={labels.rtl}
      />
      <TargetMarker />
      <Interactions world={world} labels={labels} touch={touch} />
      {labels.story && (
        <StoryLayer
          world={world}
          labels={labels.story}
          reducedMotion={reducedMotion}
          rtl={labels.rtl}
        />
      )}
      <FollowCamera world={world} />
      <Clouds center={center} reducedMotion={reducedMotion} />
      <Birds center={center} reducedMotion={reducedMotion} />
      <Atmosphere world={world} phone={touch} reducedMotion={reducedMotion} />
      <MetaLayer
        world={world}
        labels={metaLabels}
        touch={touch}
        reducedMotion={reducedMotion}
      />
      {debug && <WalkGridViz world={world} />}
      {process.env.NODE_ENV !== "production" && <ExposeThree />}
    </>
  );
}

function LoadingVeil({
  label,
  show,
}: {
  label: string;
  show: boolean;
}): ReactNode {
  const { active, progress } = useProgress();
  if (!show && !active) return null;
  return (
    <div className="bg-background/70 pointer-events-none absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm transition-opacity">
      <div className="flex flex-col items-center gap-3">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        <span className="text-muted-foreground text-xs">
          {label} {active ? `${Math.round(progress)}%` : ""}
        </span>
      </div>
    </div>
  );
}

/**
 * The 3D sky-islands world (React Three Fiber). Mounted client-only by play-view; it
 * speaks to the existing React overlays only through `gameEvents`.
 */
export function World3D({
  charId,
  dict,
  locale,
}: {
  charId: string;
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const touch = useMediaQuery("(pointer: coarse)");
  const rtRef = useRef<Runtime>(createRuntime(false));
  const [manifest, setManifest] = useState<Manifest | null | undefined>(
    undefined
  );
  const [bounds, setBounds] = useState<Record<string, ModelBounds | null>>({});
  const [dpr, setDpr] = useState(1.5);
  const [shadowSize, setShadowSize] = useState(2048);
  const debug = useMemo(
    () =>
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debug") === "1",
    []
  );

  useEffect(() => {
    rtRef.current.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  // Dev: ?island=<id> spawns on that island (kept across world rebuilds).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const id = new URLSearchParams(window.location.search).get("island");
    if (id) rtRef.current.spawnIsland = id;
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchManifest(ctrl.signal).then(async (m) => {
      // Real bounds for hex-edge models (fences, walls) before the walk grid is built.
      const bounds = m
        ? await fetchModelBounds(
            m,
            modelsNeedingBounds(ISLANDS_3D, m),
            ctrl.signal
          )
        : {};
      if (!ctrl.signal.aborted) {
        setBounds(bounds);
        setManifest(m);
      }
    });
    return () => ctrl.abort();
  }, []);

  useInputAndFreeze(rtRef);

  const world = useMemo(
    () =>
      manifest === undefined
        ? null
        : buildGameWorld(ISLANDS_3D, BRIDGES, MAYORS, manifest, { bounds }),
    [manifest, bounds]
  );
  const labels = useMemo(() => buildLabels(dict, locale), [dict, locale]);
  const metaLabels = useMemo<FireLabels>(
    () => ({
      light: dict.play.meta.fireLight,
      lit: dict.play.meta.fireLit,
      litHint: dict.play.meta.fireLitHint,
      tap: dict.play.tap,
      rtl: isRtl(locale),
    }),
    [dict, locale]
  );
  const moveLabels = useMemo<MovementLabels>(
    () => ({
      glide: dict.play.movement.glide,
      glideAction: dict.play.movement.glideAction,
      bounce: dict.play.movement.bounce,
      jumpDown: dict.play.movement.jumpDown,
      zip: dict.play.movement.zip,
      tap: dict.play.tap,
      rtl: isRtl(locale),
    }),
    [dict, locale]
  );

  const balloonLabels = useMemo<BalloonPromptLabels>(
    () => ({
      board: dict.play.movement.balloon.board,
      boardAction: dict.play.movement.balloon.boardAction,
      tap: dict.play.tap,
      rtl: isRtl(locale),
    }),
    [dict, locale]
  );
  const balloonHud = useMemo<BalloonHudLabels>(() => {
    const names: Record<string, string> = {};
    const all = dict.world.islands as Record<string, { name?: string }>;
    for (const [id, v] of Object.entries(all)) if (v?.name) names[id] = v.name;
    return { ...dict.play.movement.balloon, islands: names };
  }, [dict]);

  // Expose the runtime for automated checks in development.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __game3d?: unknown }).__game3d = {
      rt: rtRef.current,
      world,
      carLogic,
    };
    return () => {
      delete (window as unknown as { __game3d?: unknown }).__game3d;
    };
  }, [world]);

  return (
    <div className="relative h-full w-full" data-engine="3d">
      <Canvas
        shadows="percentage"
        dpr={[1, dpr]}
        camera={{ fov: 42, near: 0.1, far: 900, position: [0, 12, 14] }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        style={{ background: SKY.haze, touchAction: "none" }}
      >
        <RuntimeContext.Provider value={rtRef}>
          <PerformanceMonitor
            onDecline={() => {
              setDpr(1);
              setShadowSize(1024);
            }}
            onIncline={() => setDpr(Math.min(2, window.devicePixelRatio || 1))}
            flipflops={3}
          >
            <AdaptiveDpr pixelated={false} />
            <Suspense fallback={null}>
              {world && (
                <Scene
                  world={world}
                  manifest={manifest ?? null}
                  charId={charId}
                  labels={labels}
                  touch={touch}
                  debug={debug}
                  shadowSize={touch ? Math.min(shadowSize, 1024) : shadowSize}
                  reducedMotion={reducedMotion}
                  visitorLabel={dict.play.social.visitor}
                  moveLabels={moveLabels}
                  metaLabels={metaLabels}
                  balloonLabels={balloonLabels}
                />
              )}
            </Suspense>
          </PerformanceMonitor>
        </RuntimeContext.Provider>
      </Canvas>
      {/* A soft vignette (CSS, free) instead of a post-processing pass. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 45%, transparent 55%, rgba(38, 26, 58, 0.32) 100%)",
        }}
      />
      {touch && <Joystick rtRef={rtRef} />}
      <GlideHud
        rtRef={rtRef}
        hint={
          touch
            ? dict.play.movement.glideTouchHint
            : dict.play.movement.glideHint
        }
        landLabel={dict.play.movement.land}
        touch={touch}
        rtl={isRtl(locale)}
      />
      <BalloonHud
        rtRef={rtRef}
        labels={balloonHud}
        touch={touch}
        rtl={isRtl(locale)}
      />
      <DriveHud
        rtRef={rtRef}
        hint={touch ? dict.play.driveTouchHint : dict.play.driveHint}
        exitLabel={dict.play.exitCar}
        touch={touch}
        rtl={isRtl(locale)}
      />
      {world && (
        <MetaHud
          rtRef={rtRef}
          world={world}
          dict={dict}
          touch={touch}
          rtl={isRtl(locale)}
        />
      )}
      {debug && world && <DebugOverlay rtRef={rtRef} world={world} />}
      <LoadingVeil label={dict.play.loading} show={!world} />
    </div>
  );
}
