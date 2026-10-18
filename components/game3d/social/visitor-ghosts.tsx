"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import * as THREE from "three";

import { PRESENCE } from "@/lib/social/config";
import { socialLive } from "@/lib/social/live";
import {
  getServerSocialPrefs,
  getSocialPrefs,
  subscribeSocialPrefs,
} from "@/lib/social/prefs";
import { CHARACTER_COLORS, playerModelFor } from "../assets/characters";
import { CharacterModel, type AnimState } from "../entities/character-model";
import type { Manifest } from "../logic/types";
import { islandBob, useRuntimeRef, type Runtime } from "../runtime";
import {
  ghostAlpha,
  sampleGhost,
  selectNearest,
  shouldSend,
  toWire,
  type GhostPose,
  type MoveMode,
  type Pose,
  type SendState,
} from "./presence-logic";
import {
  ghosts,
  prune,
  selfId,
  sendPosition,
  setPresenceChar,
  startPresence,
} from "./presence-link";

/** Wait this long after the world appears before loading the Realtime client. */
const START_DELAY_MS = 1500;
const SELECT_INTERVAL_S = 0.5;
const GHOST_OPACITY = 0.5;
const GLOW = new THREE.Color("#bfe3ff");

/** Walk / drive / glide, from the movement system's `rt.move.mode` when present. */
function modeOf(rt: Runtime): MoveMode {
  if (rt.car.driving) return "drive";
  const mode = (rt as unknown as { move?: { mode?: unknown } }).move?.mode;
  return mode === "glide" ? "glide" : "walk";
}

/**
 * Other visitors as translucent, softly glowing ghosts of their chosen characters (the
 * nearest 12), plus sending this visitor's own anonymous position. Mounted inside the
 * scene once the world exists; the Supabase client loads lazily after a short delay.
 */
export function VisitorGhosts({
  manifest,
  charId,
  reducedMotion,
  label,
  rtl,
}: {
  manifest: Manifest | null;
  charId: string;
  reducedMotion: boolean;
  /** Localised "Visitor". */
  label: string;
  rtl: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const prefs = useSyncExternalStore(
    subscribeSocialPrefs,
    getSocialPrefs,
    getServerSocialPrefs
  );
  const charRef = useRef(charId);
  const [slots, setSlots] = useState<string[]>([]);
  const last = useRef<SendState>(null);
  const pose = useRef<Pose>({
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    island: null,
    mode: "walk",
    char: charId,
  });
  const acc = useRef(0);

  useEffect(() => {
    let stop: (() => void) | null = null;
    const timer = setTimeout(() => {
      stop = startPresence(charRef.current);
    }, START_DELAY_MS);
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, []);

  useEffect(() => {
    charRef.current = charId;
    setPresenceChar(charId);
  }, [charId]);

  useFrame((_, dt) => {
    const rt = rtRef.current;
    const p = rt.player.pos;
    socialLive.island = rt.player.islandId;
    const now = performance.now();
    if (prefs.share && rt.placed) {
      const ps = pose.current;
      ps.x = p.x;
      ps.y = p.y;
      ps.z = p.z;
      ps.heading = rt.player.heading;
      ps.island = rt.player.islandId;
      ps.mode = modeOf(rt);
      ps.char = charRef.current;
      if (shouldSend(last.current, now, ps)) {
        if (sendPosition(toWire(selfId, ps, Date.now())))
          last.current = { at: now, pose: { ...ps } };
      }
    }
    acc.current += dt;
    if (acc.current < SELECT_INTERVAL_S) return;
    acc.current = 0;
    prune(now);
    const ids = prefs.show ? selectNearest(ghosts.values(), p.x, p.z, now) : [];
    setSlots((prev) =>
      prev.length === ids.length && prev.every((id, i) => id === ids[i])
        ? prev
        : ids
    );
  });

  return (
    <group name="visitor-ghosts">
      {slots.map((id) => (
        <Ghost
          key={id}
          id={id}
          manifest={manifest}
          reducedMotion={reducedMotion}
          label={label}
          rtl={rtl}
        />
      ))}
    </group>
  );
}

type GhostMaterial = THREE.Material & {
  opacity: number;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
};

type GhostLook = {
  visit: (o: THREE.Object3D) => void;
  mats: GhostMaterial[];
  dispose: () => void;
};

/** Turns a character's meshes translucent and glowing (cloned materials, no shadows). */
function createGhostLook(): GhostLook {
  const seen = new WeakSet<THREE.Object3D>();
  const mats: GhostMaterial[] = [];
  const ghostify = (m: THREE.Material): THREE.Material => {
    const c = m.clone() as GhostMaterial;
    c.transparent = true;
    c.opacity = GHOST_OPACITY;
    c.depthWrite = true;
    if (c.emissive) {
      c.emissive.copy(GLOW);
      c.emissiveIntensity = 0.45;
    }
    mats.push(c);
    return c;
  };
  const visit = (o: THREE.Object3D): void => {
    if (seen.has(o)) return;
    seen.add(o);
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(ghostify)
      : ghostify(mesh.material);
  };
  const dispose = (): void => {
    for (const m of mats) m.dispose();
    mats.length = 0;
  };
  return { visit, mats, dispose };
}

function setLookOpacity(look: GhostLook, opacity: number): void {
  for (const m of look.mats) m.opacity = opacity;
}

function Ghost({
  id,
  manifest,
  reducedMotion,
  label,
  rtl,
}: {
  id: string;
  manifest: Manifest | null;
  reducedMotion: boolean;
  label: string;
  rtl: boolean;
}): ReactNode {
  const [char, setChar] = useState(() => ghosts.get(id)?.char ?? "char_0");
  const group = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const anim = useRef<AnimState>({ anim: "idle", speed: 0 });
  const out = useRef<GhostPose>({ x: 0, y: 0, z: 0, h: 0, speed: 0 });
  const scanIn = useRef(0);
  const phase = useMemo(() => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
    return h;
  }, [id]);
  const modelName = useMemo(
    () => playerModelFor(manifest, char),
    [manifest, char]
  );

  // Materials are cloned per ghost so the player's (shared) model stays opaque.
  const look = useRef<GhostLook | null>(null);
  useEffect(
    () => () => {
      look.current?.dispose();
      look.current = null;
    },
    []
  );

  useFrame(({ clock }, dt) => {
    const grp = group.current;
    const g = ghosts.get(id);
    if (!grp) return;
    if (!g) {
      grp.visible = false;
      return;
    }
    if (g.char !== char) setChar(g.char);
    // Pick up meshes as the model streams in (cheap; a few dozen nodes).
    scanIn.current -= dt;
    if (scanIn.current <= 0) {
      scanIn.current = 0.5;
      look.current ??= createGhostLook();
      grp.traverse(look.current.visit);
    }
    const now = performance.now();
    const o = sampleGhost(g, now - PRESENCE.renderDelayMs, out.current);
    const alpha = ghostAlpha(now - g.lastSeen);
    grp.visible = alpha > 0.01;
    const t = clock.elapsedTime;
    const hover = reducedMotion ? 0 : Math.sin(t * 1.6 + phase) * 0.03;
    grp.position.set(
      o.x,
      o.y + islandBob(g.island, t, reducedMotion) + hover,
      o.z
    );
    grp.rotation.y = o.h;
    const a = anim.current;
    a.speed = o.speed;
    a.anim =
      g.mode !== "walk"
        ? "idle"
        : o.speed > 6.3
          ? "run"
          : o.speed > 0.25
            ? "walk"
            : "idle";
    const pulse = reducedMotion ? 0 : Math.sin(t * 2 + phase) * 0.06;
    const op = (GHOST_OPACITY + pulse) * alpha;
    if (look.current) setLookOpacity(look.current, op);
    const el = labelRef.current;
    if (el) el.style.opacity = String(alpha);
  });

  return (
    <group ref={group} name={`ghost-${id}`}>
      <CharacterModel
        manifest={manifest}
        name={modelName}
        color={CHARACTER_COLORS[char] ?? "#9fc4ff"}
        state={anim}
      />
      <Html
        position={[0, 1.55, 0]}
        center
        zIndexRange={[20, 10]}
        style={{ pointerEvents: "none" }}
      >
        <div
          ref={labelRef}
          dir={rtl ? "rtl" : "ltr"}
          data-social-ghost={id}
          className="rounded-full bg-sky-950/55 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-sky-50 shadow-sm backdrop-blur-sm"
        >
          {label}
        </div>
      </Html>
    </group>
  );
}
