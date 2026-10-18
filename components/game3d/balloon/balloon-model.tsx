"use client";

/**
 * The hot-air balloon, built in code (flat-shaded low poly, CC0 as original work): a
 * teardrop envelope of 12 vertical gores in the site's warm sunset colours (vertical
 * stripes only, the gores meet in a point at the crown, no band across them), a basket
 * woven in horizontal courses, four ropes straight up from the basket corners to the
 * envelope's load ring, a square load frame with one bar across holding the burner (no
 * cross), a burner flame (two additive cones and a soft glow) and a small triangle
 * pennant. One merged mesh for the envelope, one for the basket and rigging, two for the
 * flame and a sprite: a handful of draw calls. Origin at the basket floor's centre.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { assign } from "../fx/assign";
import { BALLOON } from "./balloon-logic";

const GORES = 12;
/** Sunset palette (the site accent, its dark variant, the glider orange, warm cream). */
const GORE_COLORS = ["#e0703c", "#f7e2b8", "#ab4c24", "#f2a541"] as const;
const WICKER = ["#b8854e", "#9a6a3a"] as const;
const RIM = "#6e4426";
const ROPE = "#4a3a2c";
const METAL = "#3c3a3a";
const PENNANT = "#fff1d6";

// The model is built at unit size and scaled by BALLOON.size as a whole (collision sizes in
// BALLOON are the same unit sizes times BALLOON.size).
const S = BALLOON.size;
const HALF = 0.65;
const BASKET_H = 1.0;
const FRAME_Y = 2.25;
const THROAT_Y = 3.3;
const THROAT_R = Math.hypot(HALF, HALF);
const BURNER_TOP = FRAME_Y + 0.15;

/** Envelope profile above the throat: [height, radius]. */
const PROFILE: readonly (readonly [number, number])[] = [
  [0, THROAT_R],
  [0.6, 1.5],
  [1.5, 2.4],
  [2.6, 3.1],
  [3.8, 3.45],
  [5.0, 3.4],
  [6.0, 3.0],
  [6.9, 2.2],
  [7.5, 1.2],
  [7.8, 0],
];

function colored(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const ni = g.index ? g.toNonIndexed() : g;
  if (ni !== g) g.dispose();
  const c = new THREE.Color(hex);
  const n = ni.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  ni.setAttribute("color", new THREE.BufferAttribute(col, 3));
  ni.deleteAttribute("uv");
  return ni;
}

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  hex: string
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return colored(g, hex);
}

/** A thin box from a to b (a rope or a strut). */
function strut(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  hex: string
): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(t, len, t);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize()
  );
  g.applyQuaternion(q);
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return colored(g, hex);
}

export function buildEnvelope(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const pt = (row: number, sector: number): [number, number, number] => {
    const [h, r] = PROFILE[row] as readonly [number, number];
    const a = (sector / GORES) * Math.PI * 2;
    return [Math.cos(a) * r, THROAT_Y + h, Math.sin(a) * r];
  };
  for (let i = 0; i < GORES; i++) {
    c.set(GORE_COLORS[i % GORE_COLORS.length] as string);
    for (let j = 0; j < PROFILE.length - 1; j++) {
      const a = pt(j, i);
      const b = pt(j, i + 1);
      const d = pt(j + 1, i);
      const e = pt(j + 1, i + 1);
      const tris = j === PROFILE.length - 2 ? [a, d, b] : [a, d, b, b, d, e];
      for (const v of tris) {
        pos.push(v[0], v[1], v[2]);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Basket, ropes, load ring and frame, burner and the pennant. */
export function buildBody(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Floor.
  parts.push(box(HALF * 2, 0.08, HALF * 2, 0, 0.04, 0, WICKER[1]));
  // Woven walls: horizontal courses, alternating shades (no grid).
  const courses = 5;
  const ch = (BASKET_H - 0.12) / courses;
  for (let k = 0; k < courses; k++) {
    const y = 0.04 + ch * (k + 0.5);
    const hex = WICKER[k % 2] as string;
    const t = 0.07;
    parts.push(box(HALF * 2, ch, t, 0, y, HALF - t / 2, hex));
    parts.push(box(HALF * 2, ch, t, 0, y, -HALF + t / 2, hex));
    parts.push(box(t, ch, HALF * 2 - t * 2, HALF - t / 2, y, 0, hex));
    parts.push(box(t, ch, HALF * 2 - t * 2, -HALF + t / 2, y, 0, hex));
  }
  // Padded rim.
  const ry = BASKET_H - 0.05;
  parts.push(box(HALF * 2 + 0.06, 0.1, 0.12, 0, ry, HALF, RIM));
  parts.push(box(HALF * 2 + 0.06, 0.1, 0.12, 0, ry, -HALF, RIM));
  parts.push(box(0.12, 0.1, HALF * 2 - 0.06, HALF, ry, 0, RIM));
  parts.push(box(0.12, 0.1, HALF * 2 - 0.06, -HALF, ry, 0, RIM));
  // Ropes straight up from the corners to the load ring.
  const corners = [
    [HALF, HALF],
    [-HALF, HALF],
    [-HALF, -HALF],
    [HALF, -HALF],
  ] as const;
  for (const [x, z] of corners)
    parts.push(
      strut(
        new THREE.Vector3(x, BASKET_H, z),
        new THREE.Vector3(x, THROAT_Y + 0.02, z),
        0.035,
        ROPE
      )
    );
  // Load ring at the throat.
  const ring = new THREE.TorusGeometry(THROAT_R, 0.045, 4, GORES);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, THROAT_Y, 0);
  parts.push(colored(ring, METAL));
  // The load frame: a square joining the ropes, with one bar across for the burner.
  const f = HALF - 0.01;
  parts.push(box(f * 2, 0.04, 0.04, 0, FRAME_Y, f, METAL));
  parts.push(box(f * 2, 0.04, 0.04, 0, FRAME_Y, -f, METAL));
  parts.push(box(0.04, 0.04, f * 2, f, FRAME_Y, 0, METAL));
  parts.push(box(0.04, 0.04, f * 2, -f, FRAME_Y, 0, METAL));
  parts.push(box(f * 2, 0.05, 0.05, 0, FRAME_Y, 0, METAL));
  // Burner.
  const burner = new THREE.CylinderGeometry(0.15, 0.18, 0.3, 8);
  burner.translate(0, FRAME_Y, 0);
  parts.push(colored(burner, METAL));
  // A gas tank in one corner of the basket.
  const tank = new THREE.CylinderGeometry(0.13, 0.13, 0.6, 8);
  tank.translate(HALF - 0.22, 0.38, -HALF + 0.22);
  parts.push(colored(tank, "#8c3a24"));
  // Pennant: a small triangle off one corner rope, pointing out.
  const pen = new THREE.BufferGeometry();
  const px = HALF;
  const pz = HALF;
  const out = Math.SQRT1_2 * 0.55;
  const v = [px, 1.95, pz, px, 1.6, pz, px + out, 1.78, pz + out];
  pen.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [...v, v[0], v[1], v[2], v[6], v[7], v[8], v[3], v[4], v[5]] as number[],
      3
    )
  );
  pen.computeVertexNormals();
  parts.push(colored(pen, PENNANT));
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error("balloon body merge failed");
  return merged;
}

type Geos = {
  envelope: THREE.BufferGeometry;
  body: THREE.BufferGeometry;
  flame: THREE.BufferGeometry;
};
let shared: Geos | null = null;

/** Built once and shared (the player's balloon and the visitors' ghost balloons). */
export function balloonGeometries(): Geos {
  if (shared) return shared;
  const flame = new THREE.ConeGeometry(0.13, 1, 6, 1, true);
  flame.translate(0, 0.5, 0);
  shared = { envelope: buildEnvelope(), body: buildBody(), flame };
  return shared;
}

let glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,214,150,1)");
    g.addColorStop(0.35, "rgba(255,150,70,0.45)");
    g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  glowTex = new THREE.CanvasTexture(canvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Imperative handles the system animates every frame (no React state). */
export type BalloonHandles = {
  root: THREE.Group;
  /** Sways (tilts) under the root; the basket floor is its pivot. */
  sway: THREE.Group;
  flameOuter: THREE.Mesh;
  flameInner: THREE.Mesh;
  glow: THREE.Sprite;
  envelopeMat: THREE.MeshStandardMaterial;
  tethers: THREE.Group;
};

export const FLAME_BASE = BURNER_TOP;

/** The player's balloon (with flame, glow and the field's tethers). */
export const BalloonModel = forwardRef<BalloonHandles>(
  function BalloonModel(_, ref): ReactNode {
    const geos = useMemo(() => balloonGeometries(), []);
    const root = useRef<THREE.Group>(null);
    const sway = useRef<THREE.Group>(null);
    const flameOuter = useRef<THREE.Mesh>(null);
    const flameInner = useRef<THREE.Mesh>(null);
    const glow = useRef<THREE.Sprite>(null);
    const tethers = useRef<THREE.Group>(null);
    const mats = useMemo(() => {
      const envelope = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        side: THREE.DoubleSide,
        roughness: 0.7,
        emissive: new THREE.Color("#ffd2a0"),
        emissiveIntensity: 0,
      });
      // Lit from inside: each gore glows in its own colour (emissive times the vertex
      // colour), so the stripes stay readable at night.
      envelope.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;"
        );
      };
      envelope.customProgramCacheKey = () => "balloon-envelope";
      const body = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        side: THREE.DoubleSide,
        roughness: 0.9,
      });
      const outer = new THREE.MeshBasicMaterial({
        color: "#ff9a3c",
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const inner = new THREE.MeshBasicMaterial({
        color: "#ffe9a8",
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const glowMat = new THREE.SpriteMaterial({
        map: glowTexture(),
        color: "#ffb070",
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        opacity: 0,
      });
      return { envelope, body, outer, inner, glowMat };
    }, []);
    useEffect(
      () => () => {
        for (const m of Object.values(mats)) m.dispose();
      },
      [mats]
    );
    useImperativeHandle(ref, () => ({
      root: root.current as THREE.Group,
      sway: sway.current as THREE.Group,
      flameOuter: flameOuter.current as THREE.Mesh,
      flameInner: flameInner.current as THREE.Mesh,
      glow: glow.current as THREE.Sprite,
      envelopeMat: mats.envelope,
      tethers: tethers.current as THREE.Group,
    }));
    return (
      <group ref={root} name="balloon">
        <group scale={S}>
          <group ref={sway}>
            <mesh
              geometry={geos.envelope}
              material={mats.envelope}
              castShadow
            />
            <mesh
              geometry={geos.body}
              material={mats.body}
              castShadow
              receiveShadow
            />
            <mesh
              ref={flameOuter}
              geometry={geos.flame}
              material={mats.outer}
              position={[0, BURNER_TOP, 0]}
              renderOrder={2}
            />
            <mesh
              ref={flameInner}
              geometry={geos.flame}
              material={mats.inner}
              position={[0, BURNER_TOP, 0]}
              scale={[0.55, 0.6, 0.55]}
              renderOrder={3}
            />
            <sprite
              ref={glow}
              material={mats.glowMat}
              position={[0, BURNER_TOP + 0.5, 0]}
              renderOrder={4}
            />
          </group>
          <Tethers ref={tethers} />
        </group>
      </group>
    );
  }
);

/** Tether peg offsets at unit size (local, the basket's +z side): spread apart, never crossing. */
const UNIT_PEGS: readonly (readonly [number, number])[] = [
  [HALF + 1.1, HALF + 1.4],
  [-HALF - 1.1, HALF + 1.4],
];

/** The same pegs in world metres (scaled), for placing the field on the ground. */
export const TETHER_PEGS: readonly (readonly [number, number])[] =
  UNIT_PEGS.map(([x, z]) => [x * S, z * S] as const);

/** Two tethers from the basket's two +z corners, splayed out to ground pegs. */
const Tethers = forwardRef<THREE.Group>(function Tethers(_, ref): ReactNode {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (const [px, pz] of UNIT_PEGS) {
      const a = new THREE.Vector3(Math.sign(px) * HALF, 0.55, HALF);
      const b = new THREE.Vector3(px, 0.06, pz);
      parts.push(strut(a, b, 0.03, ROPE));
      const peg = new THREE.CylinderGeometry(0.05, 0.03, 0.3, 5);
      peg.translate(b.x, 0.08, b.z);
      parts.push(colored(peg, RIM));
    }
    const m = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    return m;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }),
    []
  );
  useEffect(
    () => () => {
      geo?.dispose();
      mat.dispose();
    },
    [geo, mat]
  );
  return (
    <group ref={ref}>
      {geo ? <mesh geometry={geo} material={mat} castShadow /> : null}
    </group>
  );
});

let ghostMat: THREE.MeshStandardMaterial | null = null;

/** A translucent balloon for another visitor who is ballooning (shared material). */
export const GhostBalloon = forwardRef<THREE.Group>(
  function GhostBalloon(_, ref): ReactNode {
    const geos = useMemo(() => balloonGeometries(), []);
    const mat = useMemo(() => {
      ghostMat ??= new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        emissive: new THREE.Color("#bfe3ff"),
        emissiveIntensity: 0.25,
      });
      return ghostMat;
    }, []);
    return (
      <group ref={ref} visible={false}>
        <group scale={S}>
          <mesh
            geometry={geos.envelope}
            material={mat}
            userData={{ keepMaterial: true }}
          />
          <mesh
            geometry={geos.body}
            material={mat}
            userData={{ keepMaterial: true }}
          />
        </group>
      </group>
    );
  }
);

/** The field's little sign: two legs and a board with a painted balloon (no cross). */
export function FieldSign({
  x,
  y,
  z,
  heading,
}: {
  x: number;
  y: number;
  z: number;
  heading: number;
}): ReactNode {
  const geo = useMemo(() => {
    const parts = [
      box(0.07, 1.1, 0.07, -0.32, 0.55, 0, "#7a4f2b"),
      box(0.07, 1.1, 0.07, 0.32, 0.55, 0, "#7a4f2b"),
      box(0.9, 0.5, 0.06, 0, 1.0, 0, "#c99a62"),
    ];
    const m = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    return m;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }),
    []
  );
  // The painted emblem: an envelope (circle) over a basket (small square).
  const emblem = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0.05, 0.13, 0, Math.PI * 2, false);
    const g1 = new THREE.ShapeGeometry(shape, 10);
    const g2 = new THREE.PlaneGeometry(0.07, 0.06);
    g2.translate(0, -0.15, 0);
    const a = colored(g1, "#e0703c");
    const b = colored(g2, "#6e4426");
    const m = mergeGeometries([a, b], false);
    a.dispose();
    b.dispose();
    return m;
  }, []);
  useEffect(
    () => () => {
      geo?.dispose();
      emblem?.dispose();
      mat.dispose();
    },
    [geo, emblem, mat]
  );
  return (
    <group position={[x, y, z]} rotation={[0, heading, 0]}>
      {geo ? <mesh geometry={geo} material={mat} castShadow /> : null}
      {emblem ? (
        <mesh geometry={emblem} material={mat} position={[0, 1.0, 0.035]} />
      ) : null}
    </group>
  );
}

const PAD_RING = "#e0703c";
const PAD_DOT = "#f7e2b8";

/**
 * The marked landing pads: a flat orange ring with a cream dot in the middle on each island's
 * landing spot (a target, nothing cross-shaped). Subtle on foot; brighter, with a slow pulse,
 * while ballooning (no pulse under reduced motion).
 */
export function LandingPads({
  pads,
  active,
  reducedMotion,
}: {
  pads: readonly { x: number; y: number; z: number }[];
  active: boolean;
  reducedMotion: boolean;
}): ReactNode {
  const outer = BALLOON.basketR + 0.55; // world metres, a little wider than the basket
  const geos = useMemo(() => {
    const ring = new THREE.RingGeometry(outer - 0.28, outer, 40, 1);
    ring.rotateX(-Math.PI / 2);
    const dot = new THREE.CircleGeometry(0.32, 24);
    dot.rotateX(-Math.PI / 2);
    return { ring, dot };
  }, [outer]);
  const mats = useMemo(() => {
    const make = (hex: string): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        toneMapped: false,
      });
    return { ring: make(PAD_RING), dot: make(PAD_DOT) };
  }, []);
  useEffect(
    () => () => {
      geos.ring.dispose();
      geos.dot.dispose();
      mats.ring.dispose();
      mats.dot.dispose();
    },
    [geos, mats]
  );
  useFrame(({ clock }) => {
    const pulse =
      active && !reducedMotion
        ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4)
        : 0.5;
    const base = active ? 0.7 : 0.45;
    assign(mats.ring, "opacity", base + (active ? 0.25 * pulse : 0));
    assign(mats.dot, "opacity", base * 0.9);
  });
  return (
    <group name="balloon-landing-pads">
      {pads.map((p, i) => (
        <group key={i} position={[p.x, p.y + 0.04, p.z]}>
          <mesh geometry={geos.ring} material={mats.ring} renderOrder={1} />
          <mesh geometry={geos.dot} material={mats.dot} renderOrder={1} />
        </group>
      ))}
    </group>
  );
}
