"use client";

import {
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  Minimize2,
  Paintbrush,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { gameEvents } from "../engine/events";
import type { IslandArt } from "../engine/world/illustratedIsland";
import { ExportBar } from "./export-bar";
import { ToolInspector } from "./inspector";
import { PaletteBar } from "./palette-bar";
import { useEditorShortcuts } from "./editorShortcuts";
import {
  type EditorLayerState,
  type EditorTool,
  type MaterialClass,
} from "./types";

const TOOLS: EditorTool[] = ["brush", "fill", "doors", "spawns", "anchors"];

export function DevEditor(): ReactNode {
  const [minimized, setMinimized] = useState(false);
  const [activeTool, setActiveTool] = useState<EditorTool>("brush");
  const [activeMaterial, setActiveMaterial] = useState<MaterialClass>("road");
  const [brushSize, setBrushSize] = useState(4);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [spawnTarget, setSpawnTarget] = useState<"player" | "mayor">("player");
  const [artData, setArtData] = useState<IslandArt | null>(null);
  const [islands, setIslands] = useState<string[]>([]);
  const [activeIsland, setActiveIsland] = useState<string>("home");

  const [layers, setLayers] = useState<EditorLayerState>({
    materialOverlay: true,
    doors: true,
    spawns: true,
    anchors: true,
  });

  useEffect(() => {
    const unbindList = gameEvents.on(
      "editor:island-list",
      ({ islands: islList, activeIslandId }) => {
        setIslands(islList);
        setActiveIsland(activeIslandId);
      }
    );
    const unbindChanged = gameEvents.on(
      "editor:island-changed",
      ({ islandId }) => {
        setActiveIsland(islandId);
      }
    );
    const unbind = gameEvents.on(
      "editor:data-updated",
      ({ art, canUndo: u, canRedo: r }) => {
        setArtData(art as IslandArt);
        if (u !== undefined) setCanUndo(u);
        if (r !== undefined) setCanRedo(r);
      }
    );
    gameEvents.emit("editor:request-data");
    return () => {
      unbindList();
      unbindChanged();
      unbind();
    };
  }, []);

  useEditorShortcuts(TOOLS, (tool) => {
    setActiveTool(tool);
    setSelectedIdx(0);
    gameEvents.emit("editor:set-tool", { tool });
  });

  const handleToolSelect = (tool: EditorTool): void => {
    setActiveTool(tool);
    setSelectedIdx(0);
    gameEvents.emit("editor:set-tool", { tool });
  };

  const handleToggleLayer = (layer: keyof EditorLayerState): void => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
    gameEvents.emit("editor:toggle-layer", { layer });
  };

  const handleUpdateArt = (updater: (prev: IslandArt) => IslandArt): void => {
    if (!artData) return;
    const next = updater(artData);
    setArtData(next);
    gameEvents.emit("editor:update-art", { art: next });
  };

  return (
    <div className="dev-editor-hud pointer-events-auto fixed end-4 top-20 z-50 flex flex-col items-end gap-2 text-xs select-none">
      <div
        style={{
          boxShadow:
            "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 2px #d4a359",
          imageRendering: "pixelated",
        }}
        className="bg-background/95 w-84 rounded-none p-3 shadow-2xl backdrop-blur-md"
      >
        <div className="border-foreground/10 mb-2 flex items-center justify-between border-b pb-2">
          <div className="text-foreground flex items-center gap-1.5 font-bold tracking-wide">
            <Paintbrush className="text-accent h-3.5 w-3.5" />
            <span>Brush Editor (Dev)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canUndo}
              onClick={() => gameEvents.emit("editor:undo")}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={() => gameEvents.emit("editor:redo")}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setMinimized((v) => !v)}
              className="text-muted-foreground hover:text-foreground ml-1"
            >
              {minimized ? (
                <Maximize2 className="h-3.5 w-3.5" />
              ) : (
                <Minimize2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="space-y-2.5">
            {islands.length > 1 && (
              <div className="border-foreground/10 flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground font-mono text-[10px] uppercase">
                  Island:
                </span>
                <select
                  value={activeIsland}
                  onChange={(e) => {
                    const id = e.target.value;
                    setActiveIsland(id);
                    gameEvents.emit("editor:set-island", { islandId: id });
                  }}
                  className="border-foreground/20 bg-muted/60 text-foreground rounded-none border px-2 py-0.5 font-mono text-xs focus:outline-none"
                >
                  {islands.map((id) => (
                    <option
                      key={id}
                      value={id}
                      className="bg-background text-foreground"
                    >
                      {id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <span className="text-muted-foreground mb-1 block font-mono text-[10px] uppercase">
                Active Tool (Keys 1-5)
              </span>
              <div className="grid grid-cols-5 gap-1">
                {TOOLS.map((tool, idx) => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => handleToolSelect(tool)}
                    className={`rounded-none border px-1 py-0.5 text-center font-mono capitalize transition-colors ${
                      activeTool === tool
                        ? "border-accent bg-accent text-accent-foreground font-bold"
                        : "border-foreground/15 bg-muted/40 hover:bg-muted"
                    }`}
                  >
                    {idx + 1}.{tool.slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>

            <PaletteBar
              activeTool={activeTool}
              activeMaterial={activeMaterial}
              brushSize={brushSize}
              onSelectMaterial={(mat) => {
                setActiveMaterial(mat);
                gameEvents.emit("editor:set-material", { material: mat });
              }}
              onChangeBrushSize={(size) => {
                setBrushSize(size);
                gameEvents.emit("editor:set-brush-size", { size });
              }}
            />

            {artData && (
              <ToolInspector
                tool={activeTool}
                art={artData}
                selectedIdx={selectedIdx}
                onSelectIdx={setSelectedIdx}
                onUpdateArt={handleUpdateArt}
                spawnTarget={spawnTarget}
                onSetSpawnTarget={setSpawnTarget}
              />
            )}

            <div>
              <span className="text-muted-foreground mb-1 flex items-center gap-1 font-mono text-[10px] uppercase">
                <Layers className="h-3 w-3" />
                <span>Layers (50% Overlay)</span>
              </span>
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(layers) as Array<keyof EditorLayerState>).map(
                  (layer) => (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => handleToggleLayer(layer)}
                      className={`flex items-center justify-between border px-1.5 py-0.5 font-mono text-[10px] capitalize ${
                        layers[layer]
                          ? "border-foreground/20 bg-muted/60 text-foreground"
                          : "border-foreground/10 text-muted-foreground/40 line-through"
                      }`}
                    >
                      <span>
                        {layer === "materialOverlay"
                          ? "mat 50%"
                          : layer.slice(0, 5)}
                      </span>
                      {layers[layer] ? (
                        <Eye className="text-accent h-2.5 w-2.5" />
                      ) : (
                        <EyeOff className="h-2.5 w-2.5" />
                      )}
                    </button>
                  )
                )}
              </div>
            </div>

            <ExportBar art={artData} />
          </div>
        )}
      </div>
    </div>
  );
}
