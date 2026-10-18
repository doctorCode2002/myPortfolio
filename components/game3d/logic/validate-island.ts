/**
 * Shape validation for island JSON files. `parseIsland3D` throws a readable error on bad
 * data; `islandProblems` lists issues (duplicates, objects or doors off the grid, ...)
 * for tests. Pure.
 */

import { hexKey } from "./hex";
import type { Island3D } from "./types";

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasQR(v: unknown): boolean {
  return isObj(v) && isNum(v["q"]) && isNum(v["r"]);
}

export function parseIsland3D(json: unknown, label = "island"): Island3D {
  if (!isObj(json)) throw new Error(`${label}: not an object`);
  if (typeof json["id"] !== "string") throw new Error(`${label}: missing id`);
  const c = json["center"];
  if (!Array.isArray(c) || c.length !== 2 || !isNum(c[0]) || !isNum(c[1])) {
    throw new Error(`${label}: center must be [x, z]`);
  }
  const hexes = json["hexes"];
  if (!Array.isArray(hexes) || hexes.length === 0)
    throw new Error(`${label}: hexes must be a non-empty array`);
  hexes.forEach((h, i) => {
    if (
      !hasQR(h) ||
      typeof (h as Record<string, unknown>)["tile"] !== "string"
    ) {
      throw new Error(`${label}: hexes[${i}] needs q, r and tile`);
    }
  });
  for (const key of ["objects", "doors", "anchors", "vehicles"] as const) {
    const list = json[key];
    if (list === undefined) continue;
    if (!Array.isArray(list))
      throw new Error(`${label}: ${key} must be an array`);
    list.forEach((o, i) => {
      if (!hasQR(o)) throw new Error(`${label}: ${key}[${i}] needs q and r`);
    });
  }
  const vehicles = json["vehicles"];
  if (Array.isArray(vehicles))
    vehicles.forEach((v, i) => {
      const rec = v as Record<string, unknown>;
      if (typeof rec["id"] !== "string" || !rec["id"])
        throw new Error(`${label}: vehicles[${i}] needs an id`);
      if (rec["rot"] !== undefined && !isNum(rec["rot"]))
        throw new Error(`${label}: vehicles[${i}].rot must be a number`);
    });
  return json as unknown as Island3D;
}

/** Content problems that the renderer tolerates but designers should fix. */
export function islandProblems(island: Island3D): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  for (const h of island.hexes) {
    const k = hexKey(h.q, h.r);
    if (keys.has(k)) problems.push(`duplicate hex ${k}`);
    keys.add(k);
    if ((h.h ?? 0) < 0 || (h.h ?? 0) > 3)
      problems.push(`hex ${k} height ${h.h} outside 0..3`);
  }
  for (const o of island.objects ?? []) {
    if (!keys.has(hexKey(o.q, o.r)))
      problems.push(`object ${o.model} at ${hexKey(o.q, o.r)} is off the grid`);
  }
  for (const d of island.doors ?? []) {
    if (!keys.has(hexKey(d.q, d.r)))
      problems.push(`door ${d.buildingId} is off the grid`);
  }
  for (const a of island.anchors ?? []) {
    if (!keys.has(hexKey(a.q, a.r)))
      problems.push(`anchor ${a.id} is off the grid`);
  }
  const vehicleIds = new Set<string>();
  for (const v of island.vehicles ?? []) {
    if (vehicleIds.has(v.id)) problems.push(`duplicate vehicle ${v.id}`);
    vehicleIds.add(v.id);
    const hex = island.hexes.find((h) => h.q === v.q && h.r === v.r);
    if (!hex) problems.push(`vehicle ${v.id} is off the grid`);
    else if (/water/i.test(hex.tile))
      problems.push(`vehicle ${v.id} is parked on water`);
  }
  const s = island.spawns?.player;
  if (!s) problems.push("missing spawns.player");
  else if (!keys.has(hexKey(s.q, s.r)))
    problems.push("player spawn is off the grid");
  return problems;
}
