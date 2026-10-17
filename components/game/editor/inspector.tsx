"use client";

import { Plus, Trash2 } from "lucide-react";
import { type ReactNode } from "react";
import type { IslandArt } from "../engine/world/illustratedIsland";
import { DoorInspector } from "./door-inspector";
import { type EditorTool } from "./types";

interface InspectorProps {
  tool: EditorTool;
  art: IslandArt;
  selectedIdx: number;
  onSelectIdx: (idx: number) => void;
  onUpdateArt: (updater: (prev: IslandArt) => IslandArt) => void;
  spawnTarget: "player" | "mayor";
  onSetSpawnTarget: (target: "player" | "mayor") => void;
}

export function ToolInspector({
  tool,
  art,
  selectedIdx,
  onSelectIdx,
  onUpdateArt,
  spawnTarget,
  onSetSpawnTarget,
}: InspectorProps): ReactNode {
  if (tool === "doors") {
    return (
      <DoorInspector
        art={art}
        selectedIdx={selectedIdx}
        onSelectIdx={onSelectIdx}
        onUpdateArt={onUpdateArt}
      />
    );
  }

  if (tool === "spawns") {
    return (
      <div className="border-foreground/15 bg-muted/30 space-y-1 border p-2 font-mono text-[10px]">
        <div className="text-muted-foreground uppercase">Spawn Target</div>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => onSetSpawnTarget("player")}
            className={`border px-1 py-0.5 ${
              spawnTarget === "player"
                ? "border-green-400 bg-green-500/20 font-bold text-green-300"
                : "border-foreground/20 hover:bg-muted"
            }`}
          >
            Player: [{art.spawns.player?.join(",") ?? "none"}]
          </button>
          <button
            type="button"
            onClick={() => onSetSpawnTarget("mayor")}
            className={`border px-1 py-0.5 ${
              spawnTarget === "mayor"
                ? "border-purple-400 bg-purple-500/20 font-bold text-purple-300"
                : "border-foreground/20 hover:bg-muted"
            }`}
          >
            Mayor: [{art.spawns.mayor?.join(",") ?? "none"}]
          </button>
        </div>
      </div>
    );
  }

  if (tool === "anchors") {
    const cur = art.anchors[selectedIdx] ?? art.anchors[0];
    const addAnchor = (): void => {
      onUpdateArt((prev) => ({
        ...prev,
        anchors: [
          ...prev.anchors,
          {
            id: "to_island",
            at: [Math.round(prev.size.w / 2), prev.size.h - 40],
          },
        ],
      }));
      onSelectIdx(art.anchors.length);
    };

    const deleteAnchor = (): void => {
      onUpdateArt((prev) => ({
        ...prev,
        anchors: prev.anchors.filter((_, i) => i !== selectedIdx),
      }));
      onSelectIdx(Math.max(0, selectedIdx - 1));
    };

    return (
      <div className="border-foreground/15 bg-muted/30 space-y-1.5 border p-2 font-mono text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground uppercase">
            Anchors ({art.anchors.length})
          </span>
          <button
            type="button"
            onClick={addAnchor}
            className="border-foreground/20 hover:bg-muted flex items-center gap-0.5 border px-1 py-0.5"
          >
            <Plus className="h-2.5 w-2.5" /> Add
          </button>
        </div>
        {cur && (
          <div className="flex gap-1">
            <input
              type="text"
              value={cur.id}
              onChange={(e) => {
                const val = e.target.value;
                onUpdateArt((prev) => {
                  const next = [...prev.anchors];
                  if (next[selectedIdx])
                    next[selectedIdx] = { ...next[selectedIdx]!, id: val };
                  return { ...prev, anchors: next };
                });
              }}
              className="border-foreground/20 bg-background flex-1 border px-1.5 py-0.5 text-[11px]"
              placeholder="anchor_id"
            />
            <button
              type="button"
              onClick={deleteAnchor}
              className="border border-red-500/30 p-1 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
