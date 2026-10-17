"use client";

import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import {
  FallbackObjects,
  FallbackTiles,
  FALLBACK_COLORS,
  tileColor,
  type ColoredInstance,
} from "../assets/fallbacks";
import {
  InstancedModel,
  type InstanceTransform,
} from "../assets/instanced-model";
import { allowedModel, modelUrl } from "../assets/manifest";
import type { GradeMode } from "../fx/grade";
import { createWaterMaterial } from "../fx/water";
import {
  isFoliage,
  isWaterTile,
  objectKind,
  type ObjectKind,
} from "../logic/catalog";
import { meadowColor } from "../logic/ground";
import { hexKey } from "../logic/hex";
import { createRng, seedFromString } from "../logic/noise";
import { scatterDecor } from "../logic/scatter";
import type { Island3D, Manifest } from "../logic/types";
import { buildUnderside } from "../logic/underside";
import { groundLift, type IslandWalkGrid } from "../logic/walk-grid";
import { islandBob, useRuntimeRef } from "../runtime";
import {
  buildGrassSkin,
  buildWaterGeometry,
  undersideGeometry,
} from "./geometry";
import { LampGlows, type Glow } from "./lamp-glows";
import { Roots } from "./roots";
import { Waterfall } from "./waterfall";

/** Water surfaces sit this far below the tile top (KayKit water tiles top out at -0.2). */
export const WATER_DROP = 0.14;

type Placement = {
  url: string;
  foliage: boolean;
  items: InstanceTransform[];
  shadow: boolean;
  grade: GradeMode | null;
};

/** Ground decoration candidates (only those present and allowed in the manifest are used). */
const SCATTER_MODELS = [
  { name: "grass-tuft", weight: 5 },
  { name: "grass-tuft-large", weight: 3 },
  { name: "flower-yellow-a", weight: 1.2 },
  { name: "flower-purple-a", weight: 1 },
  { name: "flower-red-a", weight: 0.8 },
  { name: "rock-small-c", weight: 1 },
  { name: "plant-bush-small", weight: 0.7 },
];

/** Flat grass tiles get the continuous skin; slopes, roads, coasts and water keep their tile top. */
function isSkinTile(name: string, manifest: Manifest | null): boolean {
  const m = manifest?.models[name];
  const text = [name, ...(m?.tags ?? [])].join(" ");
  return (
    /grass/i.test(text) &&
    !/slope|ramp|coast|water|river|road|bottom/i.test(text)
  );
}

function gradeFor(name: string, manifest: Manifest | null): GradeMode {
  const m = manifest?.models[name];
  const text = [name, ...(m?.tags ?? [])].join(" ");
  if (m?.overlay || /dirt|path|plaza/i.test(name)) return "path";
  if (/road/i.test(text)) return "road";
  return "terrain";
}

/** Per-hex colour jitter (subtle) so even un-skinned tiles don't repeat exactly. */
function hexTint(
  islandId: string,
  q: number,
  r: number
): [number, number, number] {
  const rng = createRng(seedFromString(`${islandId}/${q},${r}`));
  const k = 0.93 + rng() * 0.1;
  return [k * (0.98 + rng() * 0.04), k, k * (0.97 + rng() * 0.04)];
}

/**
 * One floating island: hex tiles (manifest models, or prisms), objects (instanced per
 * model), the generated rock underside with roots, water surfaces, waterfalls, and a
 * gentle bob of the whole group.
 */
export function IslandView({
  island,
  grid,
  manifest,
}: {
  island: Island3D;
  grid: IslandWalkGrid;
  manifest: Manifest | null;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const group = useRef<THREE.Group>(null);
  const size = grid.size;
  const baseY = island.baseY ?? 0;
  const tileThickness = manifest?.tileThickness ?? 1;

  const {
    tilePlacements,
    tileFallback,
    objectPlacements,
    objectFallback,
    waterCells,
    skinCells,
    glows,
  } = useMemo(() => {
    const tileMap = new Map<string, Placement>();
    const tileFallback: ColoredInstance[] = [];
    const objectMap = new Map<string, Placement>();
    const objectFallback: (ColoredInstance & { kind: ObjectKind })[] = [];
    const skinCells: { x: number; z: number; y: number }[] = [];
    const glows: Glow[] = [];
    const add = (
      map: Map<string, Placement>,
      name: string,
      url: string,
      it: InstanceTransform,
      foliage = false,
      shadow = true,
      grade: GradeMode | null = null
    ): void => {
      let p = map.get(name);
      if (!p) {
        p = { url, foliage, items: [], shadow, grade };
        map.set(name, p);
      }
      p.items.push(it);
    };
    const fillerName = allowedModel(manifest, "hex-grass-bottom")
      ? "hex-grass-bottom"
      : null;

    for (const hex of island.hexes) {
      const cell = grid.cells.get(hexKey(hex.q, hex.r));
      if (!cell) continue;
      const rotY = ((hex.rot ?? 0) * Math.PI) / 180;
      const url = modelUrl(manifest, hex.tile);
      const flatY =
        cell.y -
        (cell.water ? 0 : groundLift(cell.x, cell.z, island.heightJitter ?? 0));
      const t: InstanceTransform = {
        x: cell.x,
        y: flatY,
        z: cell.z,
        rotY,
        scale: 1,
        tint: hexTint(island.id, hex.q, hex.r),
      };
      if (url)
        add(
          tileMap,
          hex.tile,
          url,
          t,
          false,
          false,
          gradeFor(hex.tile, manifest)
        );
      else tileFallback.push({ ...t, color: tileColor(hex.tile) });
      // Building hexes are skinned too (their footprint hides the seam); only the terrain type matters.
      if (url && isSkinTile(hex.tile, manifest) && cell.ground)
        skinCells.push({ x: cell.x, z: cell.z, y: flatY });
      // Fill under raised tiles so stacks read as solid columns.
      for (
        let top = cell.y - tileThickness;
        top > baseY + 1e-3;
        top -= tileThickness
      ) {
        const f = { ...t, y: top, rotY: 0 };
        if (top === cell.y - tileThickness) f.y = flatY - tileThickness;
        const fillerUrl = fillerName ? modelUrl(manifest, fillerName) : null;
        if (fillerName && fillerUrl)
          add(tileMap, fillerName, fillerUrl, f, false, false);
        else tileFallback.push({ ...f, color: "#8a6f55" });
      }
    }

    for (const obj of island.objects ?? []) {
      const cell = grid.cells.get(hexKey(obj.q, obj.r));
      if (!cell) continue;
      const model = allowedModel(manifest, obj.model);
      const water = isWaterTile(cell.tile, manifest);
      const t: InstanceTransform = {
        x: cell.x + (obj.offset?.[0] ?? 0),
        y: cell.y - (water ? WATER_DROP : 0),
        z: cell.z + (obj.offset?.[1] ?? 0),
        rotY: ((obj.rot ?? 0) * Math.PI) / 180,
        scale: (model?.scale ?? 1) * (obj.scale ?? 1),
      };
      const url = modelUrl(manifest, obj.model);
      if (url && model) {
        add(
          objectMap,
          obj.model,
          url,
          t,
          isFoliage(obj.model, manifest),
          model.kind !== "terrain",
          model.kind === "terrain" ? gradeFor(obj.model, manifest) : null
        );
        if ((model.tags ?? []).some((tag) => /lamp|lantern|torch/i.test(tag))) {
          glows.push({
            x: t.x,
            y: t.y + (model.height ?? 1.5) * (obj.scale ?? 1) * 0.86,
            z: t.z,
          });
        }
      } else if (!manifest?.models[obj.model]?.banned) {
        const kind = objectKind(obj.model, manifest);
        objectFallback.push({
          ...t,
          scale: obj.scale ?? 1,
          kind,
          color: FALLBACK_COLORS[kind],
        });
      }
    }
    const waterCells = [...grid.cells.values()].filter((c) => c.water);

    // Ground decoration on open grass hexes (count-capped, one instanced mesh per model).
    const skinKeys = new Set(
      skinCells.map((c) => `${c.x.toFixed(3)},${c.z.toFixed(3)}`)
    );
    const scatterCells = [...grid.cells.values()].filter((c) =>
      skinKeys.has(`${c.x.toFixed(3)},${c.z.toFixed(3)}`)
    );
    const models = SCATTER_MODELS.filter((m) => allowedModel(manifest, m.name));
    for (const it of scatterDecor(island, scatterCells, {
      models,
      size,
      maxTotal: 240,
    })) {
      const model = allowedModel(manifest, it.model);
      const url = modelUrl(manifest, it.model);
      if (!model || !url) continue;
      add(
        objectMap,
        `scatter:${it.model}`,
        url,
        {
          x: it.x,
          y: it.y,
          z: it.z,
          rotY: it.rotY,
          scale: (model.scale ?? 1) * it.scale,
          // Kenney tufts are teal; pull them towards the meadow green.
          ...(/grass|bush/.test(it.model)
            ? { tint: [0.72, 1.0, 0.48] as const }
            : {}),
        },
        isFoliage(it.model, manifest),
        false
      );
    }
    return {
      tilePlacements: [...tileMap.entries()],
      tileFallback,
      objectPlacements: [...objectMap.entries()],
      objectFallback,
      waterCells,
      skinCells,
      glows,
    };
  }, [island, grid, manifest, baseY, tileThickness, size]);

  const underside = useMemo(() => {
    const cells = [...grid.cells.values()];
    const data = buildUnderside(
      cells.map((c) => ({ x: c.x, z: c.z })),
      size,
      {
        depth: island.underside?.depth ?? 6,
        seed: island.underside?.seed ?? seedFromString(island.id),
        style: island.underside?.style ?? "rock",
        surfaceY: baseY,
        topY: baseY - tileThickness + 0.25,
      }
    );
    return { data, geometry: undersideGeometry(data) };
  }, [grid, size, island, baseY, tileThickness]);

  const undersideMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 1,
      }),
    []
  );

  const skin = useMemo(() => {
    if (skinCells.length === 0) return null;
    const amp = island.heightJitter ?? 0;
    const geometry = buildGrassSkin(
      skinCells,
      size,
      (x, z) => meadowColor(x, z),
      (x, z, flatY) => flatY + 0.012 + groundLift(x, z, amp)
    );
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    return { geometry, material };
  }, [skinCells, size, island.heightJitter]);

  const water = useMemo(() => {
    if (waterCells.length === 0) return null;
    const isWater = (q: number, r: number): boolean =>
      Boolean(grid.cells.get(hexKey(q, r))?.water);
    return {
      geometry: buildWaterGeometry(
        waterCells,
        isWater,
        size * 1.0,
        -WATER_DROP
      ),
      material: createWaterMaterial(),
    };
  }, [waterCells, grid, size]);

  useFrame(({ clock }) => {
    const rt = rtRef.current;
    if (group.current)
      group.current.position.y = islandBob(
        island.id,
        clock.elapsedTime,
        rt.reducedMotion
      );
  });

  return (
    <group ref={group} name={`island-${island.id}`}>
      {tilePlacements.map(([name, p]) => (
        <Suspense key={name} fallback={null}>
          <InstancedModel
            url={p.url}
            items={p.items}
            castShadow={false}
            grade={p.grade}
          />
        </Suspense>
      ))}
      <FallbackTiles items={tileFallback} size={size} />
      {skin && (
        <mesh geometry={skin.geometry} material={skin.material} receiveShadow />
      )}
      {objectPlacements.map(([name, p]) => (
        <Suspense key={name} fallback={null}>
          <InstancedModel
            url={p.url}
            items={p.items}
            foliage={p.foliage}
            castShadow={p.shadow}
            grade={p.grade}
          />
        </Suspense>
      ))}
      <FallbackObjects items={objectFallback} />
      <mesh
        geometry={underside.geometry}
        material={undersideMaterial}
        receiveShadow
      />
      <Roots segments={underside.data.roots} />
      <LampGlows glows={glows} />
      {water && (
        <mesh
          geometry={water.geometry}
          material={water.material}
          receiveShadow
        />
      )}
      {(island.underside?.waterfalls ?? []).map((wf) => {
        const cell = grid.cells.get(hexKey(wf.q, wf.r));
        if (!cell) return null;
        const { centroid, profile } = underside.data;
        let ang = Math.atan2(cell.z - centroid.z, cell.x - centroid.x);
        if (ang < 0) ang += Math.PI * 2;
        const bin =
          Math.floor((ang / (Math.PI * 2)) * profile.length) % profile.length;
        const rimR = (profile[bin] ?? size) * 1.06;
        return (
          <Waterfall
            key={hexKey(wf.q, wf.r)}
            cell={cell}
            centroid={underside.data.centroid}
            size={size}
            rim={{
              x: centroid.x + Math.cos(ang) * rimR,
              z: centroid.z + Math.sin(ang) * rimR,
            }}
            topY={cell.y - (cell.water ? WATER_DROP : 0.02)}
            length={underside.data.depth + 2.5}
          />
        );
      })}
    </group>
  );
}
