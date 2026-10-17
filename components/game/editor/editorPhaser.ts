import Phaser from "phaser";
import { gameEvents } from "../engine/events";
import type { IllustratedIsland } from "../engine/world/illustratedIsland";
import {
  MATERIAL_PALETTE,
  type MaterialClass,
} from "../engine/world/materialMap";
import { MaterialHistory, floodFill, paintBrush } from "./brushCanvas";
import { drawEditorOverlay } from "./editorOverlayRenderer";
import type { EditorLayerState, EditorTool } from "./types";

export function initDevEditor(
  scene: Phaser.Scene,
  island: IllustratedIsland
): () => void {
  const gfx = scene.add.graphics();
  gfx.setDepth(25000);

  let activeTool: EditorTool = "brush";
  let activeMaterial: MaterialClass = "road";
  let brushSize = 4;
  const history = new MaterialHistory();

  const layers: EditorLayerState = {
    materialOverlay: true,
    doors: true,
    spawns: true,
    anchors: true,
  };

  let activeDragPoint: [number, number] | null = null;
  const labels: Phaser.GameObjects.Text[] = [];

  const overlayTexKey = "dev_mat_overlay";
  if (scene.textures.exists(overlayTexKey))
    scene.textures.remove(overlayTexKey);
  scene.textures.addCanvas(overlayTexKey, island.materialCanvas);

  const overlayImg = scene.add.image(
    island.worldX,
    island.worldY,
    overlayTexKey
  );
  overlayImg.setOrigin(0, 0);
  overlayImg.setAlpha(0.5);
  overlayImg.setDepth(24000);
  overlayImg.setVisible(layers.materialOverlay);

  const refreshOverlay = (): void => {
    (
      scene.textures.get(overlayTexKey) as Phaser.Textures.CanvasTexture
    ).refresh();
    island.rebuildWalkGrid();
  };

  const redraw = (): void => {
    drawEditorOverlay(gfx, labels, scene, island, layers);
  };
  redraw();

  const emitUpdated = (): void => {
    gameEvents.emit("editor:data-updated", {
      art: island.art,
      canUndo: history.canUndo(),
      canRedo: history.canRedo(),
    });
  };

  const handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    const target = pointer.event.target as HTMLElement | null;
    if (target?.closest(".dev-editor-hud")) return;

    const lx = Math.round(pointer.worldX - island.worldX);
    const ly = Math.round(pointer.worldY - island.worldY);
    const col = MATERIAL_PALETTE[activeMaterial].rgb;

    if (activeTool === "brush") {
      history.push(island.materialCanvas);
      paintBrush(island.materialCanvas, lx, ly, brushSize, col);
      refreshOverlay();
      return;
    }
    if (activeTool === "fill") {
      history.push(island.materialCanvas);
      floodFill(island.materialCanvas, lx, ly, col);
      refreshOverlay();
      emitUpdated();
      return;
    }

    if (pointer.rightButtonDown()) {
      if (activeTool === "doors") {
        const dIdx = island.art.doors.findIndex(
          (d) => Math.hypot(d.at[0] - lx, d.at[1] - ly) <= 16
        );
        if (dIdx !== -1) island.art.doors.splice(dIdx, 1);
      } else if (activeTool === "anchors") {
        const aIdx = island.art.anchors.findIndex(
          (a) => Math.hypot(a.at[0] - lx, a.at[1] - ly) <= 16
        );
        if (aIdx !== -1) island.art.anchors.splice(aIdx, 1);
      }
      redraw();
      emitUpdated();
      return;
    }

    if (activeTool === "doors") {
      const d = island.art.doors.find(
        (item) => Math.hypot(item.at[0] - lx, item.at[1] - ly) <= 16
      );
      if (d) {
        activeDragPoint = d.at;
        return;
      }
      island.art.doors.push({
        buildingId: "building_" + (island.art.doors.length + 1),
        at: [lx, ly],
        radius: 32,
      });
    } else if (activeTool === "spawns") {
      island.art.spawns.player = [lx, ly];
    } else if (activeTool === "anchors") {
      const a = island.art.anchors.find(
        (item) => Math.hypot(item.at[0] - lx, item.at[1] - ly) <= 16
      );
      if (a) {
        activeDragPoint = a.at;
        return;
      }
      island.art.anchors.push({
        id: "to_bridge_" + (island.art.anchors.length + 1),
        at: [lx, ly],
      });
    }
    redraw();
    emitUpdated();
  };

  const handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (activeTool === "brush" && pointer.isDown) {
      const lx = Math.round(pointer.worldX - island.worldX);
      const ly = Math.round(pointer.worldY - island.worldY);
      paintBrush(
        island.materialCanvas,
        lx,
        ly,
        brushSize,
        MATERIAL_PALETTE[activeMaterial].rgb
      );
      refreshOverlay();
    } else if (activeDragPoint && pointer.isDown) {
      activeDragPoint[0] = Math.round(pointer.worldX - island.worldX);
      activeDragPoint[1] = Math.round(pointer.worldY - island.worldY);
      redraw();
      emitUpdated();
    }
  };

  const handlePointerUp = (): void => {
    activeDragPoint = null;
    if (activeTool === "brush") emitUpdated();
  };

  scene.input.on("pointerdown", handlePointerDown);
  scene.input.on("pointermove", handlePointerMove);
  scene.input.on("pointerup", handlePointerUp);

  const applyHistory = (fn: () => boolean): void => {
    if (fn()) {
      refreshOverlay();
      emitUpdated();
    }
  };

  const unbind = [
    gameEvents.on("editor:set-tool", ({ tool }) => {
      activeTool = tool;
      redraw();
    }),
    gameEvents.on("editor:set-material", ({ material }) => {
      if (material in MATERIAL_PALETTE)
        activeMaterial = material as MaterialClass;
    }),
    gameEvents.on("editor:set-brush-size", ({ size }) => {
      brushSize = Phaser.Math.Clamp(size, 1, 16);
    }),
    gameEvents.on("editor:undo", () =>
      applyHistory(() => history.undo(island.materialCanvas))
    ),
    gameEvents.on("editor:redo", () =>
      applyHistory(() => history.redo(island.materialCanvas))
    ),
    gameEvents.on("editor:toggle-layer", ({ layer }) => {
      if (layer in layers) {
        layers[layer as keyof EditorLayerState] =
          !layers[layer as keyof EditorLayerState];
        if (layer === "materialOverlay")
          overlayImg.setVisible(layers.materialOverlay);
        redraw();
      }
    }),
    gameEvents.on("editor:export-material", () => {
      island.materialCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "material.png";
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    }),
    gameEvents.on("editor:request-data", emitUpdated),
  ];

  return () => {
    gfx.destroy();
    overlayImg.destroy();
    if (scene.textures.exists(overlayTexKey))
      scene.textures.remove(overlayTexKey);
    for (const l of labels) l.destroy();
    scene.input.off("pointerdown", handlePointerDown);
    scene.input.off("pointermove", handlePointerMove);
    scene.input.off("pointerup", handlePointerUp);
    for (const u of unbind) u();
  };
}
