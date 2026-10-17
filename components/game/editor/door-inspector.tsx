"use client";

import { Plus, Trash2 } from "lucide-react";
import { type ReactNode } from "react";
import type { IslandArt } from "../engine/world/illustratedIsland";
import { KNOWN_BUILDING_IDS } from "./types";

interface DoorInspectorProps {
  art: IslandArt;
  selectedIdx: number;
  onSelectIdx: (idx: number) => void;
  onUpdateArt: (updater: (prev: IslandArt) => IslandArt) => void;
}

export function DoorInspector({
  art,
  selectedIdx,
  onSelectIdx,
  onUpdateArt,
}: DoorInspectorProps): ReactNode {
  const cur = art.doors[selectedIdx] ?? art.doors[0];
  const isKnown = KNOWN_BUILDING_IDS.includes(
    cur?.buildingId as (typeof KNOWN_BUILDING_IDS)[number]
  );

  const updateCur = (patch: Partial<IslandArt["doors"][0]>): void => {
    onUpdateArt((prev) => {
      const next = [...prev.doors];
      if (next[selectedIdx])
        next[selectedIdx] = { ...next[selectedIdx]!, ...patch };
      return { ...prev, doors: next };
    });
  };

  const addDoor = (): void => {
    onUpdateArt((prev) => ({
      ...prev,
      doors: [
        ...prev.doors,
        {
          buildingId: "custom_building",
          at: [Math.round(prev.size.w / 2), Math.round(prev.size.h / 2)],
          radius: 32,
        },
      ],
    }));
    onSelectIdx(art.doors.length);
  };

  const deleteDoor = (): void => {
    onUpdateArt((prev) => ({
      ...prev,
      doors: prev.doors.filter((_, i) => i !== selectedIdx),
    }));
    onSelectIdx(Math.max(0, selectedIdx - 1));
  };

  return (
    <div className="border-foreground/15 bg-muted/30 space-y-1.5 border p-2 font-mono text-[10px]">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground uppercase">
          Door ({art.doors.length})
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={addDoor}
            className="border-foreground/20 hover:bg-muted flex items-center gap-0.5 border px-1 py-0.5"
          >
            <Plus className="h-2.5 w-2.5" /> Add
          </button>
          {cur && (
            <button
              type="button"
              onClick={deleteDoor}
              className="border border-red-500/30 px-1 py-0.5 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {art.doors.length > 1 && (
        <select
          value={selectedIdx}
          onChange={(e) => onSelectIdx(Number(e.target.value))}
          className="border-foreground/20 bg-background w-full border px-1 py-0.5 text-[11px]"
        >
          {art.doors.map((d, i) => (
            <option key={i} value={i}>
              #{i + 1}: {d.buildingId}
            </option>
          ))}
        </select>
      )}

      {cur && (
        <div className="space-y-1 pt-0.5">
          <label className="text-muted-foreground block">
            Building ID Dropdown / Text:
          </label>
          <select
            value={isKnown ? cur.buildingId : "custom"}
            onChange={(e) =>
              updateCur({
                buildingId:
                  e.target.value === "custom"
                    ? "custom_building"
                    : e.target.value,
              })
            }
            className="border-foreground/20 bg-background w-full border px-1 py-0.5 text-[11px]"
          >
            {KNOWN_BUILDING_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
            <option value="custom">Custom...</option>
          </select>
          <input
            type="text"
            value={cur.buildingId}
            onChange={(e) => updateCur({ buildingId: e.target.value })}
            className="border-foreground/20 bg-background w-full border px-1.5 py-0.5 text-[11px]"
            placeholder="building_id"
          />
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <span className="text-muted-foreground">
              Radius: {cur.radius}px
            </span>
            <input
              type="range"
              min="16"
              max="64"
              step="4"
              value={cur.radius}
              onChange={(e) => updateCur({ radius: Number(e.target.value) })}
              className="w-24 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
