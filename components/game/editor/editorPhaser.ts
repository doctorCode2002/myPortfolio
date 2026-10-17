import Phaser from "phaser";
import { gameEvents } from "../engine/events";
import type {
  IllustratedIsland,
  IslandArt,
} from "../engine/world/illustratedIsland";
import { drawEditorOverlay } from "./editorOverlayRenderer";
import type { EditorLayerState, EditorTool } from "./types";

export function initDevEditor(
  scene: Phaser.Scene,
  island: IllustratedIsland
): () => void {
  const gfx = scene.add.graphics();
  gfx.setDepth(25000);

  let activeTool: EditorTool = "walkable";
  const layers: EditorLayerState = {
    walkable: true,
    blockers: true,
    doors: true,
    occluders: true,
    spawns: true,
    anchors: true,
  };

  let activeDragPoint: [number, number] | null = null;
  const labels: Phaser.GameObjects.Text[] = [];

  const redraw = (): void => {
    drawEditorOverlay(gfx, labels, scene, island, layers);
  };

  redraw();

  const handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    const target = pointer.event.target as HTMLElement | null;
    if (target?.closest(".dev-editor-hud")) return;

    const lx = Math.round(pointer.worldX - island.worldX);
    const ly = Math.round(pointer.worldY - island.worldY);
    const poly =
      activeTool === "walkable"
        ? island.art.walkable[0]
        : activeTool === "blockers"
          ? island.art.blockers[0]
          : null;

    if (pointer.rightButtonDown()) {
      if (poly) {
        const idx = poly.findIndex(
          ([x, y]) => Math.hypot(x - lx, y - ly) <= 12
        );
        if (idx !== -1 && poly.length > 3) {
          poly.splice(idx, 1);
          redraw();
          gameEvents.emit("editor:data-updated", { art: island.art });
        }
      } else if (activeTool === "doors") {
        const dIdx = island.art.doors.findIndex(
          (d) => Math.hypot(d.at[0] - lx, d.at[1] - ly) <= 16
        );
        if (dIdx !== -1) {
          island.art.doors.splice(dIdx, 1);
          redraw();
          gameEvents.emit("editor:data-updated", { art: island.art });
        }
      }
      return;
    }

    if (poly) {
      const pt = poly.find(([x, y]) => Math.hypot(x - lx, y - ly) <= 12);
      if (pt) {
        activeDragPoint = pt;
        return;
      }
    } else if (activeTool === "doors") {
      const d = island.art.doors.find(
        (item) => Math.hypot(item.at[0] - lx, item.at[1] - ly) <= 16
      );
      if (d) {
        activeDragPoint = d.at;
        return;
      }
    } else if (activeTool === "anchors") {
      const a = island.art.anchors.find(
        (item) => Math.hypot(item.at[0] - lx, item.at[1] - ly) <= 16
      );
      if (a) {
        activeDragPoint = a.at;
        return;
      }
    }

    if (pointer.leftButtonDown()) {
      if (poly) poly.push([lx, ly]);
      else if (activeTool === "doors") {
        island.art.doors.push({
          buildingId: "building_" + (island.art.doors.length + 1),
          at: [lx, ly],
          radius: 32,
        });
      } else if (activeTool === "spawns") {
        island.art.spawns.player = [lx, ly];
      } else if (activeTool === "anchors") {
        island.art.anchors.push({
          id: "to_bridge_" + (island.art.anchors.length + 1),
          at: [lx, ly],
        });
      }
      redraw();
      gameEvents.emit("editor:data-updated", { art: island.art });
    }
  };

  const handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (activeDragPoint && pointer.isDown) {
      activeDragPoint[0] = Math.round(pointer.worldX - island.worldX);
      activeDragPoint[1] = Math.round(pointer.worldY - island.worldY);
      redraw();
      gameEvents.emit("editor:data-updated", { art: island.art });
    }
  };

  const handlePointerUp = (): void => {
    activeDragPoint = null;
  };

  scene.input.on("pointerdown", handlePointerDown);
  scene.input.on("pointermove", handlePointerMove);
  scene.input.on("pointerup", handlePointerUp);

  const unbind = [
    gameEvents.on("editor:set-tool", ({ tool }) => {
      activeTool = tool;
      redraw();
    }),
    gameEvents.on("editor:toggle-layer", ({ layer }) => {
      if (layer in layers) {
        layers[layer as keyof EditorLayerState] =
          !layers[layer as keyof EditorLayerState];
        redraw();
      }
    }),
    gameEvents.on("editor:update-art", ({ art }) => {
      island.art = art as IslandArt;
      redraw();
    }),
    gameEvents.on("editor:request-data", () => {
      gameEvents.emit("editor:data-updated", { art: island.art });
    }),
  ];

  return () => {
    gfx.destroy();
    for (const l of labels) l.destroy();
    scene.input.off("pointerdown", handlePointerDown);
    scene.input.off("pointermove", handlePointerMove);
    scene.input.off("pointerup", handlePointerUp);
    for (const u of unbind) u();
  };
}
