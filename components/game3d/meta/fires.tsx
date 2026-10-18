"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { gameEvents } from "@/components/game/engine/events";
import { FIRE_RANGE } from "@/lib/content/collectibles";
import { emitSoundCue } from "../audio/sound-store";
import { assign } from "../fx/assign";
import { sharedUniforms } from "../fx/shared-time";
import { createMistTexture } from "../island/geometry";
import type { GameWorld } from "../logic/world-layout";
import { islandBob, useRuntimeRef } from "../runtime";
import { placeFires, type Placed } from "./placement";
import { lightFire, liveProgress } from "./store";

export type FireLabels = {
  light: string;
  lit: string;
  litHint: string;
  tap: string;
  rtl: boolean;
};

const FLAME_H = 0.8;

function painted(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex);
  const n = ng.attributes.position!.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  ng.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  ng.deleteAttribute("uv");
  return ng;
}

/** A procedural brazier: an iron bowl on three legs, a stone foot and a teepee of logs. */
function brazierGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bowl = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.05, 0),
      new THREE.Vector2(0.22, 0.04),
      new THREE.Vector2(0.34, 0.16),
      new THREE.Vector2(0.38, 0.26),
      new THREE.Vector2(0.34, 0.27),
      new THREE.Vector2(0.3, 0.18),
      new THREE.Vector2(0.05, 0.1),
    ],
    9
  );
  bowl.translate(0, 0.62, 0);
  parts.push(painted(bowl, "#4b4039"));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.CylinderGeometry(0.035, 0.045, 0.72, 5);
    leg.rotateZ(0.22);
    leg.rotateY(a);
    leg.translate(Math.cos(a) * 0.17, 0.34, -Math.sin(a) * 0.17);
    parts.push(painted(leg, "#3a312b"));
  }
  const foot = new THREE.CylinderGeometry(0.42, 0.48, 0.08, 7);
  foot.translate(0, 0.04, 0);
  parts.push(painted(foot, "#8d8378"));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const log = new THREE.CylinderGeometry(0.03, 0.045, 0.34, 5);
    log.rotateZ(0.55);
    log.rotateY(a);
    log.translate(Math.cos(a) * 0.08, 0.86, -Math.sin(a) * 0.08);
    parts.push(painted(log, "#6e4a31"));
  }
  const merged = mergeGeometries(parts, false) ?? parts[0]!;
  merged.computeVertexNormals();
  for (const p of parts) if (p !== merged) p.dispose();
  return merged;
}

function flameMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedUniforms.uTime,
      uMotion: sharedUniforms.uMotion,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uMotion;
      varying float vH;
      varying float vPhase;
      void main() {
        vH = clamp(position.y / ${FLAME_H.toFixed(2)}, 0.0, 1.0);
        vec4 world = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vPhase = world.x * 1.7 + world.z * 2.3;
        vec3 p = position;
        float sway = uMotion * vH * vH;
        p.x += sin(uTime * 6.0 + vPhase + p.y * 7.0) * 0.06 * sway;
        p.z += cos(uTime * 5.3 + vPhase + p.y * 6.0) * 0.06 * sway;
        p.y *= 1.0 + uMotion * 0.12 * sin(uTime * 9.0 + vPhase);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uMotion;
      varying float vH;
      varying float vPhase;
      void main() {
        vec3 base = vec3(1.0, 0.86, 0.42);
        vec3 tip = vec3(1.0, 0.32, 0.08);
        vec3 col = mix(base, tip, smoothstep(0.0, 0.9, vH));
        float flicker = 0.85 + 0.15 * sin(uTime * 13.0 + vPhase) * uMotion;
        float a = (1.0 - vH) * flicker;
        gl_FragColor = vec4(col * a * 1.4, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * Signal fires: a brazier beside each island's arrival point (instanced: one draw for the
 * braziers, one for the flames, one for the glows). Walk up and press E (or tap) to light
 * it; lit fires are fast-travel destinations on the minimap.
 */
export function SignalFires({
  world,
  labels,
  touch,
}: {
  world: GameWorld;
  labels: FireLabels;
  touch: boolean;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const fires = useMemo(() => placeFires(world), [world]);
  const braziers = useRef<THREE.InstancedMesh>(null);
  const flames = useRef<THREE.InstancedMesh>(null);
  const glow = useRef<THREE.Points>(null);
  const [near, setNear] = useState<{ fire: Placed; lit: boolean } | null>(null);
  const nearRef = useRef<{ fire: Placed; lit: boolean } | null>(null);

  const geometry = useMemo(() => brazierGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.85,
        metalness: 0.15,
      }),
    []
  );
  const flameGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.2, FLAME_H, 7, 4, true);
    g.translate(0, FLAME_H / 2, 0);
    return g;
  }, []);
  const flameMat = useMemo(() => flameMaterial(), []);
  const glowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(fires.length * 3), 3)
    );
    return g;
  }, [fires.length]);
  const glowMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: createMistTexture(),
        color: "#ffae5c",
        size: 2.6,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      flameGeo.dispose();
      flameMat.dispose();
      glowGeo.dispose();
      glowMat.map?.dispose();
      glowMat.dispose();
    },
    [geometry, material, flameGeo, flameMat, glowGeo, glowMat]
  );

  const light = useCallback((): void => {
    const rt = rtRef.current;
    const n = nearRef.current;
    if (!n || n.lit || rt.frozen || rt.car.driving || gameEvents.isUiLocked())
      return;
    if (lightFire(n.fire.islandId)) {
      emitSoundCue({ kind: "chime", strength: 0.8, pitch: 0.5 });
      nearRef.current = { fire: n.fire, lit: true };
      setNear(nearRef.current);
    }
  }, [rtRef]);

  // E lights the fire in reach (when no door, mayor or car prompt is nearer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || e.code !== "KeyE") return;
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      const rt = rtRef.current;
      if (rt.nearest || !nearRef.current || nearRef.current.lit) return;
      e.preventDefault();
      light();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [light, rtRef]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const frame = useRef(0);

  useFrame(({ clock }) => {
    const b = braziers.current;
    const f = flames.current;
    const gp = glow.current;
    if (!b || !f || !gp) return;
    const rt = rtRef.current;
    const t = clock.elapsedTime;
    const lit = liveProgress().fires;
    const pos = gp.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fires.length; i++) {
      const fire = fires[i] as Placed;
      const bob = islandBob(fire.islandId, t, rt.reducedMotion);
      dummy.position.set(fire.x, fire.ground + bob, fire.z);
      dummy.rotation.set(0, i * 1.3, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      b.setMatrixAt(i, dummy.matrix);
      const on = lit.includes(fire.islandId);
      dummy.position.setY(fire.ground + bob + 0.8);
      dummy.scale.setScalar(on ? 1 : 0);
      dummy.updateMatrix();
      f.setMatrixAt(i, dummy.matrix);
      pos.setXYZ(i, fire.x, on ? fire.ground + bob + 1.1 : -9999, fire.z);
    }
    b.instanceMatrix.needsUpdate = true;
    f.instanceMatrix.needsUpdate = true;
    pos.needsUpdate = true;
    assign(glowMat, "opacity", 0.55 + sharedUniforms.uNight.value * 0.35);

    // The fire in reach (a few times a second).
    frame.current = (frame.current + 1) % 6;
    if (frame.current !== 0) return;
    const p = rt.player.pos;
    let hit: { fire: Placed; lit: boolean } | null = null;
    if (!rt.frozen && !rt.car.driving && !rt.nearest) {
      for (const fire of fires) {
        if (
          Math.hypot(p.x - fire.x, p.z - fire.z) < FIRE_RANGE &&
          Math.abs(p.y - fire.ground) < 1.5
        ) {
          hit = { fire, lit: lit.includes(fire.islandId) };
          break;
        }
      }
    }
    const prev = nearRef.current;
    if (hit?.fire !== prev?.fire || hit?.lit !== prev?.lit) {
      nearRef.current = hit;
      setNear(hit);
    }
  });

  return (
    <group name="meta-fires">
      <instancedMesh
        ref={braziers}
        args={[geometry, material, fires.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={flames}
        args={[flameGeo, flameMat, fires.length]}
        frustumCulled={false}
      />
      <points
        ref={glow}
        geometry={glowGeo}
        material={glowMat}
        frustumCulled={false}
      />
      {near && (
        <Html
          position={[near.fire.x, near.fire.ground + 1.75, near.fire.z]}
          center
          zIndexRange={[35, 30]}
          style={{ pointerEvents: "none" }}
        >
          {near.lit ? (
            <div
              dir={labels.rtl ? "rtl" : "ltr"}
              className="border-foreground/15 bg-background/90 text-foreground flex max-w-[16rem] flex-col rounded-full border px-3 py-1.5 text-start text-xs leading-tight font-medium whitespace-nowrap shadow-lg backdrop-blur-md sm:text-sm"
            >
              <span className="font-semibold">{labels.lit}</span>
              <span className="text-muted-foreground text-[11px]">
                {labels.litHint}
              </span>
            </div>
          ) : (
            <button
              type="button"
              dir={labels.rtl ? "rtl" : "ltr"}
              onClick={light}
              onPointerDown={(e) => e.stopPropagation()}
              data-meta-fire={near.fire.islandId}
              className="border-foreground/15 bg-background/90 text-foreground pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg backdrop-blur-md transition-transform duration-150 hover:scale-105 motion-reduce:transition-none sm:text-sm"
            >
              <kbd className="bg-accent text-background flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold">
                {touch ? labels.tap : "E"}
              </kbd>
              <span className="font-semibold">{labels.light}</span>
            </button>
          )}
        </Html>
      )}
    </group>
  );
}
