import Phaser from "phaser";
import type { IllustratedIsland } from "../engine/world/illustratedIsland";
import type { EditorLayerState } from "./types";

export function drawEditorOverlay(
  gfx: Phaser.GameObjects.Graphics,
  labels: Phaser.GameObjects.Text[],
  scene: Phaser.Scene,
  island: IllustratedIsland,
  layers: EditorLayerState
): void {
  gfx.clear();
  for (const l of labels) l.destroy();
  labels.length = 0;

  const { worldX: wx, worldY: wy, art } = island;

  const addLabel = (
    x: number,
    y: number,
    text: string,
    color: string
  ): void => {
    const lbl = scene.add.text(x, y, text, {
      fontSize: "10px",
      color,
      backgroundColor: "#000000bb",
    });
    lbl.setDepth(25001);
    labels.push(lbl);
  };

  if (layers.doors) {
    gfx.lineStyle(2, 0xffcc00, 0.9);
    gfx.fillStyle(0xffcc00, 0.2);
    for (const door of art.doors) {
      const dx = wx + door.at[0],
        dy = wy + door.at[1];
      gfx.fillCircle(dx, dy, door.radius);
      gfx.strokeCircle(dx, dy, door.radius);
      gfx.fillStyle(0xffcc00, 1);
      gfx.fillCircle(dx, dy, 4);
      addLabel(dx - 18, dy - door.radius - 14, door.buildingId, "#ffcc00");
    }
  }

  if (layers.spawns) {
    if (art.spawns.player) {
      const [px, py] = [wx + art.spawns.player[0], wy + art.spawns.player[1]];
      gfx.lineStyle(2, 0x33ff33, 1);
      gfx.strokeCircle(px, py, 12);
      gfx.lineBetween(px - 16, py, px + 16, py);
      gfx.lineBetween(px, py - 16, px, py + 16);
    }
    if (art.spawns.mayor) {
      const [mx, my] = [wx + art.spawns.mayor[0], wy + art.spawns.mayor[1]];
      gfx.lineStyle(2, 0xbb33ff, 1);
      gfx.strokeCircle(mx, my, 12);
      gfx.lineBetween(mx - 16, my, mx + 16, my);
      gfx.lineBetween(mx, my - 16, mx, my + 16);
    }
  }

  if (layers.anchors) {
    gfx.lineStyle(2, 0xff8800, 1);
    gfx.fillStyle(0xff8800, 0.5);
    for (const anc of art.anchors) {
      const ax = wx + anc.at[0],
        ay = wy + anc.at[1];
      gfx.fillPoints(
        [
          new Phaser.Geom.Point(ax, ay - 8),
          new Phaser.Geom.Point(ax + 8, ay),
          new Phaser.Geom.Point(ax, ay + 8),
          new Phaser.Geom.Point(ax - 8, ay),
        ],
        true
      );
      addLabel(ax + 10, ay - 6, anc.id, "#ff8800");
    }
  }
}
