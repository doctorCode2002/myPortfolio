import type { Dictionary } from "@/app/[lang]/dictionaries";

export type MetaDict = Dictionary["play"]["meta"];

/** Fill `{name}` placeholders. */
export function fmt(
  text: string,
  vars: Readonly<Record<string, string | number>>
): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m
  );
}

/** The localised island name (dict.world.islands[id].name), or the id. */
export function islandName(dict: Dictionary, id: string): string {
  const islands = dict.world.islands as Record<string, { name?: string }>;
  return islands[id]?.name ?? id;
}
