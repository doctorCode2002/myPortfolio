import { useEffect } from "react";
import { gameEvents } from "../engine/events";
import type { EditorTool } from "./types";

export function useEditorShortcuts(
  tools: EditorTool[],
  onSelectTool: (tool: EditorTool) => void
): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        gameEvents.emit(e.shiftKey ? "editor:redo" : "editor:undo");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        gameEvents.emit("editor:redo");
        return;
      }
      const tool = tools[Number(e.key) - 1];
      if (tool) onSelectTool(tool);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tools, onSelectTool]);
}
