"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

import { gameEvents } from "@/components/game/engine/events";
import type { IslandStory } from "@/lib/content/tours";
import type { GameWorld, Interactable } from "../logic/world-layout";
import { useRuntimeRef } from "../runtime";
import { setPromptLift } from "./registry";
import type { StoryLabels } from "./labels";
import { glowTexture, placeholderScreen } from "./textures";

/** Outer frame size (metres) and the 16:9 screen inside it. */
const FRAME_W = 2.5;
const FRAME_H = 1.6;
const SCREEN_W = 2.3;
const SCREEN_H = (SCREEN_W * 9) / 16;
const BAR = 0.1;
/** Load the screenshot once the player is this close (the island has streamed in). */
const LOAD_RADIUS = 42;
/** Seconds per slide (only when there are several and motion is allowed). */
const SLIDE_SECONDS = 7;
const FADE_SECONDS = 0.8;
/** The frame: top, bottom, right and left bars as [x, y, width, height]. */
const RIM = (FRAME_H - SCREEN_H) / 2;
const FRAME_BARS: readonly (readonly [number, number, number, number])[] = [
  [0, (FRAME_H - RIM) / 2, FRAME_W, RIM],
  [0, -(FRAME_H - RIM) / 2, FRAME_W, RIM],
  [(FRAME_W - BAR) / 2, 0, BAR, SCREEN_H],
  [-(FRAME_W - BAR) / 2, 0, BAR, SCREEN_H],
];

export type WindowPlacement = {
  x: number;
  y: number;
  z: number;
  groundY: number;
  heading: number;
};

/** World pose of a story's project window, or null when its hex is missing. */
export function windowPlacement(
  world: GameWorld,
  story: IslandStory
): WindowPlacement | null {
  const grid = world.walk.islands.find((g) => g.islandId === story.islandId);
  const cell = grid?.cells.get(`${story.window.at.q},${story.window.at.r}`);
  const face = grid?.cells.get(`${story.window.face.q},${story.window.face.r}`);
  if (!cell) return null;
  const x = cell.x + (story.window.offset?.[0] ?? 0);
  const z = cell.z + (story.window.offset?.[1] ?? 0);
  const heading = face ? Math.atan2(face.x - x, face.z - z) : 0;
  return { x, y: cell.y + story.window.lift, z, groundY: cell.y, heading };
}

function prepare(tex: THREE.Texture, anisotropy: number): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * A framed screen beside a project's portal showing the project's real screenshot (the
 * same image as the site's project card), with a soft glow and a slow slideshow when
 * there are several images (manual with reduced motion). Clicking it, or pressing E in
 * front of it, opens the portal panel.
 */
export function ProjectWindow({
  world,
  story,
  images,
  accent,
  labels,
  reducedMotion,
}: {
  world: GameWorld;
  story: IslandStory;
  images: readonly string[];
  accent: string;
  labels: StoryLabels;
  reducedMotion: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const gl = useThree((s) => s.gl);
  const place = useMemo(() => windowPlacement(world, story), [world, story]);
  const buildingId = `portal_${story.islandId}`;
  const [active, setActive] = useState(false);
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);
  const fade = useRef<THREE.MeshBasicMaterial>(null);
  const prevTex = useRef<THREE.Texture | null>(null);
  const fadeT = useRef(0);
  const slideT = useRef(0);
  const checkT = useRef(0);
  const title = labels.titles[story.islandId] ?? story.islandId;
  const fallback = useMemo(
    () =>
      active
        ? placeholderScreen(
            title,
            failed ? labels.screenUnavailable : labels.screen,
            accent
          )
        : null,
    [active, failed, title, labels.screenUnavailable, labels.screen, accent]
  );

  // E in front of the screen opens the portal panel (the shared prompt system).
  useEffect(() => {
    if (!place) return;
    const front: Interactable = {
      kind: "door",
      id: buildingId,
      islandId: story.islandId,
      x: place.x + Math.sin(place.heading) * 1.1,
      y: place.groundY,
      z: place.z + Math.cos(place.heading) * 1.1,
      range: 1.5,
      q: story.window.at.q,
      r: story.window.at.r,
    };
    setPromptLift(front, 0.55);
    world.interactables.push(front);
    return () => {
      const i = world.interactables.indexOf(front);
      if (i >= 0) world.interactables.splice(i, 1);
    };
  }, [world, place, buildingId, story]);

  // Lazy: load the screenshots once the player is near this island.
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const loader = new THREE.TextureLoader();
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const loaded: (THREE.Texture | null)[] = images.map(() => null);
    images.forEach((url, i) => {
      loader.load(
        url,
        (tex) => {
          if (!alive) {
            tex.dispose();
            return;
          }
          loaded[i] = prepare(tex, aniso);
          setTextures([...loaded]);
        },
        undefined,
        () => {
          if (!alive) return;
          console.warn("[game3d] project screenshot missing", url);
          setFailed(true);
        }
      );
    });
    return () => {
      alive = false;
      for (const t of loaded) t?.dispose();
    };
  }, [active, images, gl]);

  useEffect(() => () => fallback?.dispose(), [fallback]);

  const count = images.length;
  const current = textures[index % Math.max(1, count)] ?? fallback;

  const go = (step: number): void => {
    if (count < 2) return;
    prevTex.current = current;
    fadeT.current = FADE_SECONDS;
    slideT.current = 0;
    setIndex((i) => (i + step + count) % count);
  };

  useFrame((_, rawDt) => {
    if (!place) return;
    const dt = Math.min(rawDt, 0.1);
    const p = rtRef.current.player.pos;
    checkT.current -= dt;
    if (checkT.current <= 0) {
      checkT.current = 0.5;
      const d = Math.hypot(p.x - place.x, p.z - place.z);
      if (!active && d < LOAD_RADIUS) setActive(true);
      const isNear = d < 7;
      if (isNear !== near) setNear(isNear);
    }
    if (count > 1 && !reducedMotion && textures.some(Boolean)) {
      slideT.current += dt;
      if (slideT.current > SLIDE_SECONDS) go(1);
    }
    const m = fade.current;
    if (m) {
      fadeT.current = Math.max(0, fadeT.current - dt);
      m.opacity = reducedMotion ? 0 : fadeT.current / FADE_SECONDS;
      m.visible = m.opacity > 0.001 && Boolean(prevTex.current);
      if (m.map !== prevTex.current) {
        m.map = prevTex.current;
        m.needsUpdate = true;
      }
    }
  });

  if (!place) return null;

  const open = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    const rt = rtRef.current;
    if (rt.frozen || rt.car.driving || gameEvents.isUiLocked()) return;
    rt.path = null;
    rt.target = null;
    gameEvents.emit("interact:building", { buildingId });
  };
  const hover = (on: boolean) => (): void => {
    document.body.style.cursor = on ? "pointer" : "";
  };

  return (
    <group
      position={[place.x, place.y, place.z]}
      rotation={[0, place.heading, 0]}
    >
      {/* Back panel and a plain rectangular frame (four bars, no crossing pieces). */}
      <mesh position={[0, 0, -0.05]} castShadow>
        <boxGeometry args={[FRAME_W, FRAME_H, 0.06]} />
        <meshStandardMaterial color="#3b2a20" roughness={0.8} />
      </mesh>
      {FRAME_BARS.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.005]} castShadow>
          <boxGeometry args={[w, h, 0.07]} />
          <meshStandardMaterial color="#6b4a32" roughness={0.65} />
        </mesh>
      ))}
      <mesh
        position={[0, 0, 0.012]}
        onClick={open}
        onPointerOver={hover(true)}
        onPointerOut={hover(false)}
        name={`window-${story.islandId}`}
      >
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial
          key={current?.uuid ?? "empty"}
          map={current}
          color={current ? "#ffffff" : "#1d2230"}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.014]} renderOrder={1}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial
          ref={fade}
          transparent
          depthWrite={false}
          toneMapped={false}
          opacity={0}
          visible={false}
        />
      </mesh>
      {/* Halo behind the frame and a soft pool of light on the ground below. */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[FRAME_W + 1.1, FRAME_H + 1.1]} />
        <meshBasicMaterial
          map={glowTexture()}
          color={accent}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        position={[0, place.groundY - place.y + 0.04, 0.4]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[1.25, 24]} />
        <meshBasicMaterial
          map={glowTexture()}
          color={accent}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {count > 1 && near ? (
        <Html
          position={[0, -FRAME_H / 2 - 0.22, 0.05]}
          center
          zIndexRange={[33, 30]}
        >
          <div className="flex gap-2">
            {[-1, 1].map((step) => (
              <button
                key={step}
                type="button"
                aria-label={step < 0 ? labels.prevImage : labels.nextImage}
                onClick={() => go(step)}
                onPointerDown={(e) => e.stopPropagation()}
                className="bg-background/90 text-foreground border-foreground/15 h-7 w-7 rounded-full border text-sm font-bold shadow"
              >
                {step < 0 ? "‹" : "›"}
              </button>
            ))}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
