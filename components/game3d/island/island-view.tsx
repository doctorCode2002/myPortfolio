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
import { createWaterMaterial } from "../fx/water";
import {
  isFoliage,
  isWaterTile,
  objectKind,
  type ObjectKind,
} from "../logic/catalog";
import { hexKey } from "../logic/hex";
import { seedFromString } from "../logic/noise";
import type { Island3D, Manifest } from "../logic/types";
import { buildUnderside } from "../logic/underside";
import type { IslandWalkGrid } from "../logic/walk-grid";
import { islandBob, useRuntimeRef } from "../runtime";
import { buildWaterGeometry, undersideGeometry } from "./geometry";
import { Roots } from "./roots";
import { Waterfall } from "./waterfall";

/** Water surfaces sit this far below the tile top (KayKit water tiles top out at -0.2). */
export const WATER_DROP = 0.14;

type Placement = {
  url: string;
  foliage: boolean;
  items: InstanceTransform[];
  shadow: boolean;
};

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
  } = useMemo(() => {
    const tileMap = new Map<string, Placement>();
    const tileFallback: ColoredInstance[] = [];
    const objectMap = new Map<string, Placement>();
    const objectFallback: (ColoredInstance & { kind: ObjectKind })[] = [];
    const add = (
      map: Map<string, Placement>,
      name: string,
      url: string,
      it: InstanceTransform,
      foliage = false,
      shadow = true
    ): void => {
      let p = map.get(name);
      if (!p) {
        p = { url, foliage, items: [], shadow };
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
      const t: InstanceTransform = {
        x: cell.x,
        y: cell.y,
        z: cell.z,
        rotY,
        scale: 1,
      };
      if (url) add(tileMap, hex.tile, url, t, false, false);
      else tileFallback.push({ ...t, color: tileColor(hex.tile) });
      // Fill under raised tiles so stacks read as solid columns.
      for (
        let top = cell.y - tileThickness;
        top > baseY + 1e-3;
        top -= tileThickness
      ) {
        const f = { ...t, y: top, rotY: 0 };
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
          model.kind !== "terrain"
        );
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
    return {
      tilePlacements: [...tileMap.entries()],
      tileFallback,
      objectPlacements: [...objectMap.entries()],
      objectFallback,
      waterCells,
    };
  }, [island, grid, manifest, baseY, tileThickness]);

  const underside = useMemo(() => {
    const cells = [...grid.cells.values()];
    const data = buildUnderside(
      cells.map((c) => ({ x: c.x, z: c.z })),
      size,
      {
        depth: island.underside?.depth ?? 6,
        seed: island.underside?.seed ?? seedFromString(island.id),
        style: island.underside?.style ?? "rock",
        topY: baseY - tileThickness + 0.08,
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
          <InstancedModel url={p.url} items={p.items} castShadow={false} />
        </Suspense>
      ))}
      <FallbackTiles items={tileFallback} size={size} />
      {objectPlacements.map(([name, p]) => (
        <Suspense key={name} fallback={null}>
          <InstancedModel
            url={p.url}
            items={p.items}
            foliage={p.foliage}
            castShadow={p.shadow}
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
        return (
          <Waterfall
            key={hexKey(wf.q, wf.r)}
            cell={cell}
            centroid={underside.data.centroid}
            size={size}
            topY={cell.y - (cell.water ? WATER_DROP : 0.02)}
            length={(island.underside?.depth ?? 6) + 2.5}
          />
        );
      })}
    </group>
  );
}
