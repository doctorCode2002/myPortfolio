"use client";

import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState, type ReactNode } from "react";
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
import { zoomToDistance } from "../logic/camera-math";
import {
  isFoliage,
  isGroundDecal,
  isSeasonalFoliage,
  isWaterTile,
  objectKind,
  type ObjectKind,
} from "../logic/catalog";
import {
  groundColor,
  groundSide,
  islandPalette,
  type GroundPalette,
} from "../logic/ground";
import { HEX_DIRECTIONS, hexKey } from "../logic/hex";
import { createRng, seedFromString } from "../logic/noise";
import { buildRoadNetwork, isRoadTile, onRoad } from "../logic/roads";
import { scatterDecor } from "../logic/scatter";
import type { Island3D, Manifest } from "../logic/types";
import { buildUnderside } from "../logic/underside";
import {
  cellHeightAt,
  groundLift,
  objectKey,
  type IslandWalkGrid,
  type WalkCell,
} from "../logic/walk-grid";
import { islandBob, useRuntimeRef } from "../runtime";
import {
  buildGrassSkin,
  buildTerraceWalls,
  buildWaterGeometry,
  undersideGeometry,
  type TerraceWall,
} from "./geometry";
import { LampGlows, type Glow } from "./lamp-glows";
import { buildRoadGeometry } from "./road-geometry";
import { Roots } from "./roots";
import { Waterfall } from "./waterfall";

/** Water surfaces sit this far below the tile top (KayKit water tiles top out at -0.2). */
export const WATER_DROP = 0.14;

/** Island objects stream in within this range (plus the camera distance) of the player. */
const STREAM_RANGE = 14;
const STREAM_HYSTERESIS = 10;

type Placement = {
  url: string;
  foliage: boolean;
  items: InstanceTransform[];
  shadow: boolean;
  grade: GradeMode | null;
};

type SkinCell = {
  x: number;
  z: number;
  y: number;
  palette: GroundPalette;
  /** Road ramps: the skin follows the cell's slope. */
  slope?: WalkCell;
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
const DESERT_SCATTER = [
  { name: "rock-small-c", weight: 2 },
  { name: "rock-sand-a", weight: 1 },
  { name: "cactus-short", weight: 0.6 },
];

/**
 * Flat grass and sand tiles get the continuous skin; slopes, coasts and water keep their
 * tile top. Road tiles (ramps included) are skinned too: the wide road ribbons are drawn
 * over them, and a road ramp's skin follows the walk grid's slope profile (the KayKit
 * ramp's raised verges would poke through the ribbon).
 */
function isSkinTile(name: string, manifest: Manifest | null): boolean {
  const m = manifest?.models[name];
  const text = [name, ...(m?.tags ?? [])].join(" ");
  if (m && m.kind !== "terrain") return false;
  if (isRoadTile(name)) return true;
  return (
    /grass|sand|dune/i.test(text) &&
    !/slope|ramp|coast|water|river|road|bottom|stone|path/i.test(text)
  );
}

/** Sand-tagged tiles always use the sand palette. */
function tilePalette(
  name: string,
  manifest: Manifest | null
): GroundPalette | null {
  const m = manifest?.models[name];
  const text = [name, ...(m?.tags ?? [])].join(" ");
  return /sand|dune|desert/i.test(text) && !/grass/i.test(text) ? "sand" : null;
}

function gradeFor(
  name: string,
  manifest: Manifest | null,
  palette: GroundPalette
): GradeMode {
  const m = manifest?.models[name];
  const text = [name, ...(m?.tags ?? [])].join(" ");
  if (m?.overlay || /dirt|path|plaza/i.test(name)) return "path";
  if (palette === "sand" && /grass/i.test(text)) return "sand";
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

/** Pointy-top corner i (angle 60i - 30 degrees) of a cell. */
function corner(cell: WalkCell, size: number, i: number): [number, number] {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [cell.x + Math.cos(a) * size, cell.z + Math.sin(a) * size];
}

/** The tile-top height of a cell, without the deck or jitter (where tiles and props sit). */
function tileTop(
  cell: WalkCell,
  island: Island3D,
  levelHeight: number
): number {
  return (island.baseY ?? 0) + cell.level * levelHeight;
}

/**
 * One floating island: the terrain (KayKit tiles, the continuous grass skin with terrace
 * walls, the rock underside, water and waterfalls) is always drawn; its objects (props,
 * buildings, ground scatter, lamp glows) stream in when the player is within range, so
 * far islands cost only their terrain and their models load on demand.
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
  const objectsGroup = useRef<THREE.Group>(null);
  const size = grid.size;
  const baseY = island.baseY ?? 0;
  const tileThickness = manifest?.tileThickness ?? 1;
  const levelHeight = grid.levelHeight;
  const islandPal = islandPalette(island);

  const terrain = useMemo(() => {
    const tileMap = new Map<string, Placement>();
    const tileFallback: ColoredInstance[] = [];
    const skinCells: SkinCell[] = [];
    const walls: TerraceWall[] = [];
    const skinned = new Set<string>();
    const paletteOf = new Map<string, GroundPalette>();
    for (const hex of island.hexes) {
      const key = hexKey(hex.q, hex.r);
      const cell = grid.cells.get(key);
      const pal = hex.tint ?? tilePalette(hex.tile, manifest) ?? islandPal;
      paletteOf.set(key, pal);
      if (
        cell &&
        modelUrl(manifest, hex.tile) &&
        isSkinTile(hex.tile, manifest) &&
        cell.ground &&
        !cell.deck
      )
        skinned.add(key);
    }
    const fillerName = allowedModel(manifest, "hex-grass-bottom")
      ? "hex-grass-bottom"
      : null;
    const add = (
      name: string,
      url: string,
      it: InstanceTransform,
      grade: GradeMode
    ): void => {
      let p = tileMap.get(name + "|" + grade);
      if (!p) {
        p = { url, foliage: false, items: [], shadow: false, grade };
        tileMap.set(name + "|" + grade, p);
      }
      p.items.push(it);
    };

    for (const hex of island.hexes) {
      const key = hexKey(hex.q, hex.r);
      const cell = grid.cells.get(key);
      if (!cell) continue;
      const pal = paletteOf.get(key) ?? islandPal;
      const flatY = tileTop(cell, island, levelHeight);
      if (skinned.has(key)) {
        // The skin replaces the tile top; terrace walls replace its bevelled sides.
        const top = cell.y;
        skinCells.push({
          x: cell.x,
          z: cell.z,
          y: flatY,
          palette: pal,
          ...(cell.slope ? { slope: cell } : {}),
        });
        const side = groundSide(pal);
        const hAt = (c: WalkCell, x: number, z: number): number =>
          c.slope ? cellHeightAt(c, x, z, grid.hexWidth) : c.y;
        for (let i = 0; i < 6; i++) {
          const dir = HEX_DIRECTIONS[(6 - i) % 6] as { q: number; r: number };
          const nKey = hexKey(cell.q + dir.q, cell.r + dir.r);
          const n = grid.cells.get(nKey);
          const [ax, az] = corner(cell, size, i);
          const [bx, bz] = corner(cell, size, i + 1);
          const mx = (ax + bx) / 2;
          const mz = (az + bz) / 2;
          let bottom: number;
          if (!n) bottom = baseY - tileThickness;
          else if (skinned.has(nKey))
            bottom = n.slope ? Math.min(hAt(n, ax, az), hAt(n, bx, bz)) : n.y;
          else if (n.water && !n.deck)
            bottom = tileTop(n, island, levelHeight) - 0.2;
          else
            bottom = Math.min(
              cellHeightAt(n, mx, mz, grid.hexWidth),
              tileTop(n, island, levelHeight)
            );
          const topA = cell.slope ? hAt(cell, ax, az) : top;
          const topB = cell.slope ? hAt(cell, bx, bz) : top;
          if (Math.max(topA, topB) - bottom > 0.02)
            walls.push({
              ax,
              az,
              bx,
              bz,
              top: topA + 0.012,
              ...(cell.slope ? { topB: topB + 0.012 } : {}),
              bottom: bottom - 0.01,
              lip: side.lip,
              soil: side.soil,
            });
        }
        continue;
      }
      const rotY = ((hex.rot ?? 0) * Math.PI) / 180;
      const url = modelUrl(manifest, hex.tile);
      const t: InstanceTransform = {
        x: cell.x,
        y: flatY,
        z: cell.z,
        rotY,
        scale: 1,
        tint: hexTint(island.id, hex.q, hex.r),
      };
      if (url) add(hex.tile, url, t, gradeFor(hex.tile, manifest, pal));
      else tileFallback.push({ ...t, color: tileColor(hex.tile) });
      // Fill under raised tiles so stacks read as solid columns.
      for (
        let top = flatY - tileThickness;
        top > baseY + 1e-3;
        top -= tileThickness
      ) {
        const f = { ...t, y: top, rotY: 0 };
        const fillerUrl = fillerName ? modelUrl(manifest, fillerName) : null;
        if (fillerName && fillerUrl)
          add(fillerName, fillerUrl, f, gradeFor(fillerName, manifest, pal));
        else tileFallback.push({ ...f, color: "#8a6f55" });
      }
    }
    const waterCells = [...grid.cells.values()].filter((c) => c.water);
    return {
      tilePlacements: [...tileMap.entries()],
      tileFallback,
      skinCells,
      walls,
      waterCells,
      skinnedKeys: skinned,
    };
  }, [
    island,
    grid,
    manifest,
    baseY,
    tileThickness,
    size,
    levelHeight,
    islandPal,
  ]);

  const roads = useMemo(
    () =>
      buildRoadNetwork(island, grid, {
        heightJitter: island.heightJitter ?? 0,
      }),
    [island, grid]
  );

  const objects = useMemo(() => {
    const objectMap = new Map<string, Placement>();
    const objectFallback: (ColoredInstance & { kind: ObjectKind })[] = [];
    const glows: Glow[] = [];
    const add = (
      name: string,
      url: string,
      it: InstanceTransform,
      foliage: boolean,
      shadow: boolean,
      grade: GradeMode | null
    ): void => {
      let p = objectMap.get(name);
      if (!p) {
        p = { url, foliage, items: [], shadow, grade };
        objectMap.set(name, p);
      }
      p.items.push(it);
    };
    for (const [index, obj] of (island.objects ?? []).entries()) {
      const cell = grid.cells.get(hexKey(obj.q, obj.r));
      if (!cell) continue;
      const model = allowedModel(manifest, obj.model);
      const water = isWaterTile(cell.tile, manifest);
      const kind = objectKind(obj.model, manifest);
      // Bridge models sit on the tile (their deck is the raised walk surface); props on a
      // skinned hex follow the skin; props on water float at the water line.
      // Ground decals (crop rows, path stones) are lifted just above the grass skin,
      // or above the road ribbon on road hexes.
      const decalLift =
        terrain.skinnedKeys.has(hexKey(obj.q, obj.r)) &&
        isGroundDecal(obj.model, manifest)
          ? isRoadTile(cell.tile)
            ? 0.085
            : 0.03
          : 0;
      const y =
        kind === "bridge" || cell.deck
          ? tileTop(cell, island, levelHeight)
          : water
            ? tileTop(cell, island, levelHeight) - WATER_DROP
            : cell.y + decalLift;
      const t: InstanceTransform = {
        x: cell.x + (obj.offset?.[0] ?? 0),
        y,
        z: cell.z + (obj.offset?.[1] ?? 0),
        rotY: ((obj.rot ?? 0) * Math.PI) / 180,
        scale: (model?.scale ?? 1) * (obj.scale ?? 1),
        key: objectKey(island.id, index),
      };
      const url = modelUrl(manifest, obj.model);
      if (url && model) {
        const foliage = isFoliage(obj.model, manifest);
        const grade: GradeMode | null =
          model.kind === "terrain"
            ? gradeFor(obj.model, manifest, islandPal)
            : foliage && !isSeasonalFoliage(obj.model, manifest)
              ? "foliage"
              : null;
        add(obj.model, url, t, foliage, model.kind !== "terrain", grade);
        if ((model.tags ?? []).some((tag) => /lamp|lantern|torch/i.test(tag))) {
          glows.push({
            x: t.x,
            y: t.y + (model.height ?? 1.5) * (obj.scale ?? 1) * 0.86,
            z: t.z,
            key: objectKey(island.id, index),
          });
        }
      } else if (!manifest?.models[obj.model]?.banned) {
        objectFallback.push({
          ...t,
          scale: obj.scale ?? 1,
          kind,
          color: FALLBACK_COLORS[kind],
        });
      }
    }

    // Ground decoration on open skinned hexes (count-capped, one instanced mesh per model).
    const scatterCells = [...grid.cells.values()].filter(
      (c) => terrain.skinnedKeys.has(hexKey(c.q, c.r)) && !c.slope
    );
    const models = (
      islandPal === "sand" ? DESERT_SCATTER : SCATTER_MODELS
    ).filter((m) => allowedModel(manifest, m.name));
    for (const it of scatterDecor(island, scatterCells, {
      models,
      size,
      maxTotal: 200,
      // Keep the road ribbons clear (plus a margin for the item's own size).
      isClear: (x, z) => !onRoad(roads, x, z, 0.15),
    })) {
      const model = allowedModel(manifest, it.model);
      const url = modelUrl(manifest, it.model);
      if (!model || !url) continue;
      const foliage = isFoliage(it.model, manifest);
      add(
        `scatter:${it.model}`,
        url,
        {
          x: it.x,
          y: it.y,
          z: it.z,
          rotY: it.rotY,
          scale: (model.scale ?? 1) * it.scale,
        },
        foliage,
        false,
        foliage && !isSeasonalFoliage(it.model, manifest) ? "foliage" : null
      );
    }
    return {
      objectPlacements: [...objectMap.entries()],
      objectFallback,
      glows,
    };
  }, [
    island,
    grid,
    manifest,
    size,
    levelHeight,
    islandPal,
    terrain.skinnedKeys,
    roads,
  ]);

  const underside = useMemo(() => {
    const cells = [...grid.cells.values()];
    const data = buildUnderside(
      cells.map((c) => ({ x: c.x, z: c.z })),
      size,
      {
        depth: island.underside?.depth ?? 6,
        seed: island.underside?.seed ?? seedFromString(island.id),
        style: island.underside?.style ?? "rock",
        palette: islandPal,
        surfaceY: baseY,
        topY: baseY - tileThickness + 0.25,
      }
    );
    let maxR = size;
    for (const r of data.profile) maxR = Math.max(maxR, r);
    return { data, geometry: undersideGeometry(data), radius: maxR };
  }, [grid, size, island, baseY, tileThickness, islandPal]);

  const flatMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 1,
      }),
    []
  );

  const skin = useMemo(() => {
    if (terrain.skinCells.length === 0) return null;
    const amp = island.heightJitter ?? 0;
    const geometry = buildGrassSkin(
      terrain.skinCells,
      size,
      (x, z, cell) => groundColor(cell.palette, x, z),
      (x, z, flatY, cell) =>
        cell.slope
          ? cellHeightAt(cell.slope, x, z, grid.hexWidth) + 0.012
          : flatY + 0.012 + groundLift(x, z, amp)
    );
    return {
      geometry,
      material: new THREE.MeshLambertMaterial({ vertexColors: true }),
    };
  }, [terrain.skinCells, size, island.heightJitter, grid.hexWidth]);

  const roadGeometry = useMemo(
    () =>
      buildRoadGeometry(roads, grid, {
        palette: islandPal,
        heightJitter: island.heightJitter ?? 0,
      }),
    [roads, grid, islandPal, island.heightJitter]
  );

  const walls = useMemo(
    () => (terrain.walls.length ? buildTerraceWalls(terrain.walls) : null),
    [terrain.walls]
  );

  const water = useMemo(() => {
    if (terrain.waterCells.length === 0) return null;
    const isWater = (q: number, r: number): boolean =>
      Boolean(grid.cells.get(hexKey(q, r))?.water);
    return {
      geometry: buildWaterGeometry(
        terrain.waterCells,
        isWater,
        size * 1.0,
        -WATER_DROP
      ),
      material: createWaterMaterial(),
    };
  }, [terrain.waterCells, grid, size]);

  // Streaming: objects mount the first time the player comes within range, then toggle visibility.
  const [loaded, setLoaded] = useState(false);
  const frame = useRef(0);
  const centroid = underside.data.centroid;
  useFrame(({ clock }) => {
    const rt = rtRef.current;
    if (group.current)
      group.current.position.y = islandBob(
        island.id,
        clock.elapsedTime,
        rt.reducedMotion
      );
    frame.current = (frame.current + 1) % 20;
    if (frame.current !== 0) return;
    const p = rt.player.pos;
    const range = STREAM_RANGE + zoomToDistance(rt.camera.zoom) * 1.1;
    const gap =
      Math.hypot(p.x - centroid.x, p.z - centroid.z) - underside.radius;
    const g = objectsGroup.current;
    if (gap < range) {
      if (!loaded) setLoaded(true);
      if (g && !g.visible) g.visible = true;
    } else if (gap > range + STREAM_HYSTERESIS && g && g.visible) {
      g.visible = false;
    }
  });

  return (
    <group ref={group} name={`island-${island.id}`}>
      {terrain.tilePlacements.map(([name, p]) => (
        <Suspense key={name} fallback={null}>
          <InstancedModel
            url={p.url}
            items={p.items}
            castShadow={false}
            grade={p.grade}
          />
        </Suspense>
      ))}
      <FallbackTiles items={terrain.tileFallback} size={size} />
      {skin && (
        <mesh geometry={skin.geometry} material={skin.material} receiveShadow />
      )}
      {walls && <mesh geometry={walls} material={flatMaterial} receiveShadow />}
      {roadGeometry && (
        <mesh
          geometry={roadGeometry}
          material={flatMaterial}
          receiveShadow
          name={`roads-${island.id}`}
        />
      )}
      <mesh
        geometry={underside.geometry}
        material={flatMaterial}
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
        const { profile } = underside.data;
        let ang = Math.atan2(cell.z - centroid.z, cell.x - centroid.x);
        if (ang < 0) ang += Math.PI * 2;
        const bin =
          Math.floor((ang / (Math.PI * 2)) * profile.length) % profile.length;
        const rimR = (profile[bin] ?? size) * 1.06;
        return (
          <Waterfall
            key={hexKey(wf.q, wf.r)}
            cell={cell}
            centroid={centroid}
            size={size}
            rim={{
              x: centroid.x + Math.cos(ang) * rimR,
              z: centroid.z + Math.sin(ang) * rimR,
            }}
            topY={
              tileTop(cell, island, levelHeight) -
              (cell.water ? WATER_DROP : 0.02)
            }
            length={underside.data.depth + 2.5}
          />
        );
      })}
      <group ref={objectsGroup} name={`island-objects-${island.id}`}>
        {loaded && (
          <>
            {objects.objectPlacements.map(([name, p]) => (
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
            <FallbackObjects items={objects.objectFallback} />
            <LampGlows glows={objects.glows} />
          </>
        )}
      </group>
    </group>
  );
}
