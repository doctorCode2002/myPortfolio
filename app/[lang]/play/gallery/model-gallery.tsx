"use client";

import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CanvasTexture, SRGBColorSpace, type Group } from "three";

import {
  MANIFEST_URL,
  MODEL_KINDS,
  MODELS_BASE_URL,
  type ModelEntry,
  type ModelManifest,
} from "@/lib/content/manifest3d";

type Filter = (typeof MODEL_KINDS)[number] | "all" | "banned";

interface GalleryParams {
  kind: Filter;
  q: string;
  view: "side" | "top";
  spin: boolean;
  clip: string;
  /** Initial turntable angle in degrees (useful with spin off). */
  yaw: number;
}

function readParams(): GalleryParams {
  const p = new URLSearchParams(window.location.search);
  const kind = p.get("kind") ?? "all";
  return {
    kind: (["all", "banned", ...MODEL_KINDS] as string[]).includes(kind)
      ? (kind as Filter)
      : "all",
    q: p.get("q") ?? "",
    view: p.get("view") === "top" ? "top" : "side",
    spin: p.get("spin") !== "0",
    clip: p.get("clip") ?? "Idle",
    yaw: Number(p.get("yaw") ?? 0) || 0,
  };
}

function writeParams(params: GalleryParams): void {
  const p = new URLSearchParams();
  if (params.kind !== "all") p.set("kind", params.kind);
  if (params.q) p.set("q", params.q);
  if (params.view === "top") p.set("view", "top");
  if (!params.spin) p.set("spin", "0");
  if (params.clip !== "Idle") p.set("clip", params.clip);
  if (params.yaw) p.set("yaw", String(params.yaw));
  const qs = p.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${qs ? `?${qs}` : ""}`
  );
}

interface Placed {
  name: string;
  model: ModelEntry;
  x: number;
  z: number;
}

/** Shelf layout: rows of cells sized by each model's footprint, at least one hex wide. */
function layout(
  items: [string, ModelEntry][],
  hexSize: number
): { placed: Placed[]; width: number; depth: number } {
  const GAP = 1.3;
  const cellW = (m: ModelEntry) =>
    Math.max(m.size[0], m.size[2], hexSize) + GAP;
  const area = items.reduce((s, [, m]) => s + cellW(m) ** 2, 0);
  const rowWidth = Math.max(hexSize * 3, Math.sqrt(area) * 1.15);
  const placed: Placed[] = [];
  let x = 0;
  let z = 0;
  let rowDepth = 0;
  let width = 0;
  for (const [name, model] of items) {
    const w = cellW(model);
    if (x > 0 && x + w > rowWidth) {
      z += rowDepth;
      x = 0;
      rowDepth = 0;
    }
    placed.push({ name, model, x: x + w / 2, z: z + w / 2 });
    x += w;
    width = Math.max(width, x);
    rowDepth = Math.max(rowDepth, w);
  }
  const depth = z + rowDepth;
  return {
    placed: placed.map((p) => ({
      ...p,
      x: p.x - width / 2,
      z: p.z - depth / 2,
    })),
    width,
    depth,
  };
}

class LoadBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    console.error(`[gallery] ${this.props.name} failed to load`, error);
  }
  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ff2a6d" wireframe />
        </mesh>
      );
    }
    return this.props.children;
  }
}

function ModelMesh({
  name,
  model,
  spin,
  clip,
  yaw,
}: {
  name: string;
  model: ModelEntry;
  spin: boolean;
  clip: string;
  yaw: number;
}): ReactNode {
  const gltf = useGLTF(`${MODELS_BASE_URL}${model.file}`);
  const turntable = useRef<Group>(null);
  const rig = useRef<Group>(null);
  const { actions, names } = useAnimations(gltf.animations, rig);

  useEffect(() => {
    if (model.kind !== "character" || names.length === 0) return;
    const pick = names.includes(clip)
      ? clip
      : (names.find((n) => /idle/i.test(n)) ?? names[0]);
    const action = pick ? actions[pick] : undefined;
    action?.reset().fadeIn(0.2).play();
    return () => {
      action?.fadeOut(0.2);
    };
  }, [actions, names, clip, model.kind]);

  useFrame((_, dt) => {
    if (spin && turntable.current) turntable.current.rotation.y += dt * 0.5;
  });

  return (
    <group ref={turntable} name={name} rotation={[0, (yaw * Math.PI) / 180, 0]}>
      <group ref={rig} scale={model.scale} position={[0, -model.minY, 0]}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  );
}

/** Text label as a camera-facing sprite (a canvas texture; no DOM overlay, no font download). */
function Label({
  position,
  lines,
  banned,
}: {
  position: [number, number, number];
  lines: string[];
  banned: boolean;
}): ReactNode {
  const key = lines.join("\n");
  const { texture, aspect, rows } = useMemo(() => {
    const font = 28;
    const wrapped = key
      .split("\n")
      .flatMap((l) => l.match(/.{1,44}(\s|$)|.{44}/g) ?? [l]);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return { texture: null, aspect: 1, rows: 1 };
    ctx.font = `${font}px monospace`;
    const width =
      Math.ceil(Math.max(...wrapped.map((l) => ctx.measureText(l).width))) + 16;
    canvas.width = width;
    canvas.height = wrapped.length * (font + 6) + 10;
    ctx.fillStyle = banned ? "#ff2a6d" : "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${font}px monospace`;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";
    wrapped.forEach((l, i) => ctx.fillText(l.trim(), 8, 6 + i * (font + 6)));
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return {
      texture: tex,
      aspect: canvas.width / canvas.height,
      rows: wrapped.length,
    };
  }, [key, banned]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  const h = 0.3 * rows;
  return (
    <sprite position={position} scale={[h * aspect, h, 1]}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}

/** Pointy-top hex outline (corners on +-Z) with the manifest hexSize across the flats. */
function HexOutline({
  hexSize,
  color,
  y,
}: {
  hexSize: number;
  color: string;
  y: number;
}): ReactNode {
  const r = hexSize / Math.sqrt(3);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[r - 0.04, r, 6, 1, Math.PI / 2]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function Cell({
  placed,
  hexSize,
  personHeight,
  spin,
  clip,
  yaw,
}: {
  placed: Placed;
  hexSize: number;
  personHeight: number;
  spin: boolean;
  clip: string;
  yaw: number;
}): ReactNode {
  const { name, model, x, z } = placed;
  const half = Math.max(model.size[0], model.size[2], hexSize) / 2;
  const kb = (model.bytes / 1024).toFixed(0);
  return (
    <group position={[x, 0, z]}>
      <HexOutline
        hexSize={hexSize}
        color={model.banned ? "#ff2a6d" : "#8fd3ff"}
        y={model.kind === "terrain" ? model.height + 0.02 : 0.005}
      />
      {model.kind !== "terrain" && (
        // Person-height marker (0.45 x hex) at the cell's front-right corner.
        <mesh position={[half + 0.25, personHeight / 2, half + 0.25]}>
          <cylinderGeometry args={[0.1, 0.1, personHeight, 8]} />
          <meshStandardMaterial color="#ffd166" />
        </mesh>
      )}
      <LoadBoundary name={name}>
        <Suspense fallback={null}>
          <ModelMesh
            name={name}
            model={model}
            spin={spin}
            clip={clip}
            yaw={yaw}
          />
        </Suspense>
      </LoadBoundary>
      <Label
        position={[0, 0.3, half + 0.55]}
        lines={[
          `${name}  ${kb}KB${model.lazy ? " lazy" : ""}`,
          ...(model.banned ? [`BANNED: ${model.reason}`] : []),
        ]}
        banned={model.banned}
      />
    </group>
  );
}

export function ModelGallery(): ReactNode {
  const [manifest, setManifest] = useState<ModelManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<GalleryParams>(() => readParams());

  useEffect(() => {
    fetch(MANIFEST_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((m: ModelManifest) => setManifest(m))
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => writeParams(params), [params]);

  const items = useMemo(() => {
    if (!manifest) return [];
    const q = params.q.trim().toLowerCase();
    return Object.entries(manifest.models)
      .filter(([, m]) =>
        params.kind === "all"
          ? true
          : params.kind === "banned"
            ? m.banned
            : m.kind === params.kind
      )
      .filter(
        ([name, m]) =>
          !q ||
          q.split(/[\s,]+/).some((t) =>
            // A token that is an exact model name matches only that model; otherwise substring/tag match.
            t in manifest.models
              ? name === t
              : name.includes(t) || m.tags.includes(t)
          )
      )
      .sort(([a], [b]) => a.localeCompare(b));
  }, [manifest, params.kind, params.q]);

  const grid = useMemo(
    () => (manifest ? layout(items, manifest.hexSize) : null),
    [items, manifest]
  );

  if (error) {
    return (
      <p className="p-6 font-mono text-sm text-red-300">
        Manifest failed to load: {error}
      </p>
    );
  }
  if (!manifest || !grid) {
    return (
      <p className="p-6 font-mono text-sm text-white/70">Loading manifest…</p>
    );
  }

  // Fit the grid to the viewport (vertical fov 40deg: distance = half-height / tan(20deg)).
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const tallest = Math.max(0, ...grid.placed.map((p) => p.model.height));
  const fit =
    Math.max(grid.width / aspect, grid.depth, tallest * 1.3, 1.5) /
    2 /
    Math.tan((20 * Math.PI) / 180);
  const cameraPosition: [number, number, number] =
    params.view === "top"
      ? [0, fit * 0.9, 0.001]
      : [0, fit * 0.45 + tallest * 0.35, fit * 0.7];
  const filters: Filter[] = ["all", ...MODEL_KINDS, "banned"];
  const set = (patch: Partial<GalleryParams>) =>
    setParams((p) => ({ ...p, ...patch }));

  return (
    <div className="relative h-full w-full" data-gallery-count={items.length}>
      <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 bg-black/70 p-2 font-mono text-xs text-white">
        <strong className="mr-2">3D gallery (dev)</strong>
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => set({ kind: f })}
            className={`rounded px-2 py-1 ${params.kind === f ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"}`}
          >
            {f}
          </button>
        ))}
        <input
          value={params.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="filter name/tag"
          aria-label="Filter models by name or tag"
          className="w-40 rounded bg-white/10 px-2 py-1"
        />
        <button
          type="button"
          onClick={() => set({ view: params.view === "top" ? "side" : "top" })}
          className="rounded bg-white/10 px-2 py-1"
        >
          view: {params.view}
        </button>
        <button
          type="button"
          onClick={() => set({ spin: !params.spin })}
          className="rounded bg-white/10 px-2 py-1"
        >
          spin: {params.spin ? "on" : "off"}
        </button>
        <span className="opacity-70">
          {items.length} models · hexSize {manifest.hexSize} · person{" "}
          {manifest.characterHeight} · first load{" "}
          {(manifest.firstLoadBytes / 1048576).toFixed(2)} MB / total{" "}
          {(manifest.totalBytes / 1048576).toFixed(2)} MB
        </span>
      </div>
      <Canvas
        key={`${params.view}-${params.kind}-${params.q}-${params.yaw}`}
        shadows={false}
        dpr={[1, 1.5]}
        camera={{ position: cameraPosition, fov: 40, near: 0.1, far: 2000 }}
      >
        <color attach="background" args={["#1d2330"]} />
        <hemisphereLight args={["#fff4e0", "#3a4a6a", 1.4]} />
        <directionalLight position={[8, 14, 6]} intensity={2.2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[grid.width + 6, grid.depth + 6]} />
          <meshStandardMaterial color="#2a3242" />
        </mesh>
        {grid.placed.map((p) => (
          <Cell
            key={p.name}
            placed={p}
            hexSize={manifest.hexSize}
            personHeight={manifest.characterHeight}
            spin={params.spin && params.view !== "top"}
            clip={params.clip}
            yaw={params.yaw}
          />
        ))}
        <OrbitControls
          makeDefault
          target={[0, params.view === "top" ? 0 : tallest * 0.35, 0]}
        />
      </Canvas>
    </div>
  );
}
