"use client";

import {
  Check,
  Download,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  Minimize2,
  Wrench,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { gameEvents } from "../engine/events";
import type { IslandArt } from "../engine/world/illustratedIsland";
import { ToolInspector } from "./inspector";
import { type EditorLayerState, type EditorTool } from "./types";

const TOOLS: EditorTool[] = [
  "walkable",
  "blockers",
  "doors",
  "occluders",
  "spawns",
  "anchors",
];

export function DevEditor(): ReactNode {
  const [minimized, setMinimized] = useState(false);
  const [activeTool, setActiveTool] = useState<EditorTool>("walkable");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [spawnTarget, setSpawnTarget] = useState<"player" | "mayor">("player");
  const [artData, setArtData] = useState<IslandArt | null>(null);
  const [copied, setCopied] = useState(false);
  const [layers, setLayers] = useState<EditorLayerState>({
    walkable: true,
    blockers: true,
    doors: true,
    occluders: true,
    spawns: true,
    anchors: true,
  });

  useEffect(() => {
    const unbind = gameEvents.on("editor:data-updated", ({ art }) => {
      setArtData(art as IslandArt);
    });
    gameEvents.emit("editor:request-data");
    return unbind;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT") return;

      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < TOOLS.length) {
        const next = TOOLS[idx];
        if (next) {
          setActiveTool(next);
          setSelectedIdx(0);
          gameEvents.emit("editor:set-tool", { tool: next });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const handleExport = (): void => {
    if (!artData) return;
    const jsonStr = JSON.stringify(artData, null, 2);
    try {
      void navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard fails
    }
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "island.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dev-editor-hud pointer-events-auto fixed end-4 top-20 z-50 flex flex-col items-end gap-2 text-xs select-none">
      <div
        style={{
          boxShadow:
            "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 2px #d4a359",
          imageRendering: "pixelated",
        }}
        className="bg-background/95 w-80 rounded-none p-3 shadow-2xl backdrop-blur-md"
      >
        <div className="border-foreground/10 mb-2 flex items-center justify-between border-b pb-2">
          <div className="text-foreground flex items-center gap-1.5 font-bold tracking-wide">
            <Wrench className="text-accent h-3.5 w-3.5" />
            <span>Island Editor (Dev)</span>
          </div>
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {minimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {!minimized && (
          <div className="space-y-2.5">
            <div>
              <span className="text-muted-foreground mb-1 block font-mono text-[10px] uppercase">
                Active Tool (Keys 1-6)
              </span>
              <div className="grid grid-cols-3 gap-1">
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
                    {idx + 1}. {tool}
                  </button>
                ))}
              </div>
            </div>

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
                <span>Layers Toggle</span>
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(layers) as Array<keyof EditorLayerState>).map(
                  (layer) => (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => handleToggleLayer(layer)}
                      className={`flex items-center justify-between rounded-none border px-1.5 py-0.5 font-mono capitalize ${
                        layers[layer]
                          ? "border-foreground/20 bg-muted/60 text-foreground"
                          : "border-foreground/10 text-muted-foreground/40 line-through"
                      }`}
                    >
                      <span>{layer.slice(0, 5)}</span>
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

            <div className="border-foreground/10 bg-muted/20 text-muted-foreground border p-2 font-mono text-[10px]">
              <p>• Click island to add vertex</p>
              <p>• Drag vertices to adjust</p>
              <p>• Right-click vertex to delete</p>
              <p className="text-accent mt-0.5">
                • WASD / Arrows to walk & test
              </p>
            </div>

            <button
              type="button"
              onClick={handleExport}
              style={{
                boxShadow:
                  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000",
              }}
              className="focus-ring bg-accent text-accent-foreground flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-none py-1.5 text-center font-bold tracking-wide hover:opacity-90 active:translate-y-0.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Export island.json</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
