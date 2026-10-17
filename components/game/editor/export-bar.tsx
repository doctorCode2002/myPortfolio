"use client";

import { Check, Download, Image as ImageIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { gameEvents } from "../engine/events";
import type { IslandArt } from "../engine/world/illustratedIsland";

interface ExportBarProps {
  art: IslandArt | null;
}

export function ExportBar({ art }: ExportBarProps): ReactNode {
  const [copied, setCopied] = useState(false);

  const handleExportJson = (): void => {
    if (!art) return;
    const jsonStr = JSON.stringify(art, null, 2);
    try {
      void navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([jsonStr], { type: "application/json" })
    );
    a.download = "island.json";
    a.click();
  };

  return (
    <div className="grid grid-cols-2 gap-1.5 pt-1">
      <button
        type="button"
        onClick={() => gameEvents.emit("editor:export-material")}
        className="focus-ring bg-accent text-accent-foreground flex cursor-pointer items-center justify-center gap-1 py-1.5 font-bold hover:opacity-90"
      >
        <ImageIcon className="h-3 w-3" />
        <span>Export material.png</span>
      </button>
      <button
        type="button"
        onClick={handleExportJson}
        className="focus-ring border-foreground/20 bg-muted/60 hover:bg-muted flex cursor-pointer items-center justify-center gap-1 border py-1.5 font-bold"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-400" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        <span>{copied ? "Copied!" : "Export island.json"}</span>
      </button>
    </div>
  );
}
