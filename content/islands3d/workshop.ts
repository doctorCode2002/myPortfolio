/**
 * The workshop island ("Under construction"): workshop.json holds the terrain, the
 * set dressing and six predefined lots; this module fills the lots from the in-progress
 * projects (lib/content/in-progress.ts). Lot n gets the n-th project: a half-built house
 * whose stage follows the project's progress, a "coming soon" billboard, a dirt plot and a
 * door. Unused lots show an empty plot with a blank sale sign. It also places the
 * animated workers and dust puffs that components/game3d/workshop renders.
 */

import type { Island3D, IslandObject } from "@/components/game3d/logic/types";
import {
  constructionStage,
  IN_PROGRESS,
  progressBuildingId,
  projectsOnLots,
  type ConstructionStage,
  type InProgressProject,
} from "@/lib/content/in-progress";

export type WorkshopLot = {
  /** 1-based lot number (lot n hosts the n-th in-progress project). */
  lot: number;
  q: number;
  r: number;
  /** Heading of the house front (degrees), towards the door hex. */
  rot: number;
  door: { q: number; r: number };
  sign: {
    q: number;
    r: number;
    rot?: number;
    scale?: number;
    offset?: [number, number];
  };
};

export type WorkshopSource = Island3D & { lots?: WorkshopLot[] };

/** A KayKit character looping a work animation next to a half-built house. */
export type WorkshopWorker = {
  id: string;
  model: string;
  clip: string;
  q: number;
  r: number;
  offset: [number, number];
  /** Heading in degrees (0 faces +z). */
  rot: number;
};

export type WorkshopPuff = { q: number; r: number; offset: [number, number] };

export type WorkshopIsland = {
  island: Island3D;
  /** Which project sits on which lot (lot numbers are 1-based). */
  placements: { lot: number; projectId: string; buildingId: string }[];
  workers: WorkshopWorker[];
  puffs: WorkshopPuff[];
};

export const STAGE_MODEL: Record<ConstructionStage, string> = {
  foundation: "building-stage-a",
  frame: "building-stage-b",
  walls: "v2-house-walls",
  scaffold: "v2-house-roofing",
};

const BILLBOARDS = ["v2-billboard-a", "v2-billboard-b", "v2-billboard-c"];
const WORKER_MODELS = [
  "character-barbarian-bare",
  "character-knight-bare",
  "character-rogue",
];
const WORKER_CLIPS = ["Interact", "Use_Item", "PickUp"];
/** At most this many workers (they are skinned meshes; keep the cost small on phones). */
export const MAX_WORKERS = 3;

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Fill the lots of the workshop island with the given in-progress projects. */
export function buildWorkshopIsland(
  source: WorkshopSource,
  projects: readonly InProgressProject[] = IN_PROGRESS
): WorkshopIsland {
  const { lots = [], ...base } = source;
  const sorted = [...lots].sort((a, b) => a.lot - b.lot);
  const onLots = projectsOnLots(projects);
  const objects: IslandObject[] = [...(base.objects ?? [])];
  const doors = [...(base.doors ?? [])];
  const placements: WorkshopIsland["placements"] = [];
  const workers: WorkshopWorker[] = [];
  const puffs: WorkshopPuff[] = [];

  sorted.forEach((lot, i) => {
    const project = onLots[i];
    objects.push({ model: "building-dirt", q: lot.q, r: lot.r, rot: lot.rot });
    if (!project) {
      objects.push({
        model: "v2-empty-plot",
        q: lot.q,
        r: lot.r,
        rot: lot.rot,
      });
      return;
    }
    const buildingId = progressBuildingId(project.id);
    const stage = constructionStage(project.progress);
    objects.push({
      model: STAGE_MODEL[stage],
      q: lot.q,
      r: lot.r,
      rot: lot.rot,
    });
    objects.push({
      model: BILLBOARDS[i % BILLBOARDS.length] as string,
      q: lot.sign.q,
      r: lot.sign.r,
      rot: lot.sign.rot ?? lot.rot,
      ...(lot.sign.scale ? { scale: lot.sign.scale } : {}),
      ...(lot.sign.offset ? { offset: lot.sign.offset } : {}),
    });
    doors.push({ buildingId, q: lot.door.q, r: lot.door.r, radius: 0.9 });
    placements.push({ lot: lot.lot, projectId: project.id, buildingId });

    // A worker at the side of the house, facing it (the house hex is closed to walking).
    const a = rad(lot.rot);
    const sx = Math.cos(a);
    const sz = -Math.sin(a);
    const side = i % 2 === 0 ? 1 : -1;
    if (workers.length < MAX_WORKERS) {
      workers.push({
        id: `worker_${lot.lot}`,
        model: WORKER_MODELS[workers.length % WORKER_MODELS.length] as string,
        clip: WORKER_CLIPS[workers.length % WORKER_CLIPS.length] as string,
        q: lot.q,
        r: lot.r,
        offset: [
          round(sx * 0.82 * side + Math.sin(a) * 0.25),
          round(sz * 0.82 * side + Math.cos(a) * 0.25),
        ],
        rot: (lot.rot + (side > 0 ? 270 : 90)) % 360,
      });
    }
    puffs.push({
      q: lot.q,
      r: lot.r,
      offset: [round(-sx * 0.45 * side), round(-sz * 0.45 * side)],
    });
  });

  return {
    island: { ...base, objects, doors },
    placements,
    workers,
    puffs,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
