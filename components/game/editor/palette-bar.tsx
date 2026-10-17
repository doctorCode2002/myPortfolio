"use client";

import { type ReactNode } from "react";
import { MATERIAL_PALETTE, type EditorTool, type MaterialClass } from "./types";

const PALETTE_CLASSES = Object.keys(MATERIAL_PALETTE) as MaterialClass[];

interface PaletteBarProps {
  activeTool: EditorTool;
  activeMaterial: MaterialClass;
  brushSize: number;
  onSelectMaterial: (mat: MaterialClass) => void;
  onChangeBrushSize: (size: number) => void;
}

export function PaletteBar({
  activeTool,
  activeMaterial,
  brushSize,
  onSelectMaterial,
  onChangeBrushSize,
}: PaletteBarProps): ReactNode {
  if (activeTool !== "brush" && activeTool !== "fill") return null;

  return (
    <div className="border-foreground/15 bg-muted/20 space-y-2 border p-2">
      <span className="text-muted-foreground block font-mono text-[10px] uppercase">
        Material Palette ({activeMaterial})
      </span>
      <div className="grid grid-cols-5 gap-1">
        {PALETTE_CLASSES.map((cls) => {
          const def = MATERIAL_PALETTE[cls];
          return (
            <button
              key={cls}
              type="button"
              onClick={() => onSelectMaterial(cls)}
              title={`${cls}: ${def.notes}`}
              className={`flex flex-col items-center gap-0.5 border p-1 font-mono text-[9px] capitalize ${
                activeMaterial === cls
                  ? "border-accent ring-accent font-bold ring-1"
                  : "border-foreground/15 hover:bg-muted"
              }`}
            >
              <span
                className="h-3.5 w-full border border-black/40"
                style={{ backgroundColor: def.hex }}
              />
              <span>{cls.slice(0, 5)}</span>
            </button>
          );
        })}
      </div>

      {activeTool === "brush" && (
        <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[10px]">
          <span className="text-muted-foreground">Size: {brushSize}px</span>
          <input
            type="range"
            min="1"
            max="16"
            value={brushSize}
            onChange={(e) => onChangeBrushSize(Number(e.target.value))}
            className="w-32 cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
