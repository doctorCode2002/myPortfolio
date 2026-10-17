import type Phaser from "phaser";
import { matchMaterialColor } from "./materialMap";

export interface OcclusionObject {
  sprite: Phaser.GameObjects.Sprite;
  textureKey: string;
  baseY: number;
}

export function extractOcclusionObjects(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  baseTextureKey: string,
  matCanvas: HTMLCanvasElement
): OcclusionObject[] {
  const width = matCanvas.width;
  const height = matCanvas.height;
  const matCtx = matCanvas.getContext("2d", { willReadFrequently: true });
  if (!matCtx) return [];

  const matData = matCtx.getImageData(0, 0, width, height).data;

  // 1. Identify candidate pixels: roof, solid, canopy
  const isCandidate = new Uint8Array(width * height);
  const isSolid = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = matData[idx] ?? 0;
      const g = matData[idx + 1] ?? 0;
      const b = matData[idx + 2] ?? 0;
      const a = matData[idx + 3] ?? 255;

      const mat = matchMaterialColor(r, g, b, a);
      if (mat === "roof" || mat === "solid" || mat === "canopy") {
        isCandidate[y * width + x] = 1;
        if (mat === "solid") {
          isSolid[y * width + x] = 1;
        }
      }
    }
  }

  // 2. Connected component labeling (BFS with 8-connectivity)
  const visited = new Uint8Array(width * height);
  const components: Array<{
    pixels: Array<[number, number]>;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    baseY: number;
  }> = [];

  const neighbors = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = y * width + x;
      if (isCandidate[pIdx] === 0 || visited[pIdx] === 1) continue;

      const queue: Array<[number, number]> = [[x, y]];
      visited[pIdx] = 1;

      const compPixels: Array<[number, number]> = [];
      let minX = x,
        minY = y,
        maxX = x,
        maxY = y;
      let lowestSolidY = -1;
      let lowestAnyY = y;

      let head = 0;
      while (head < queue.length) {
        const cur = queue[head++];
        if (!cur) continue;
        const [cx, cy] = cur;
        compPixels.push([cx, cy]);

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (cy > lowestAnyY) lowestAnyY = cy;

        const cIdx = cy * width + cx;
        if (isSolid[cIdx] === 1 && cy > lowestSolidY) {
          lowestSolidY = cy;
        }

        for (const [dx, dy] of neighbors) {
          const nx = cx + (dx ?? 0);
          const ny = cy + (dy ?? 0);
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (isCandidate[nIdx] === 1 && visited[nIdx] === 0) {
            visited[nIdx] = 1;
            queue.push([nx, ny]);
          }
        }
      }

      // Filter out small specks (< 25 pixels)
      if (compPixels.length >= 25) {
        components.push({
          pixels: compPixels,
          minX,
          minY,
          maxX,
          maxY,
          baseY: lowestSolidY !== -1 ? lowestSolidY : lowestAnyY,
        });
      }
    }
  }

  // 3. Cut each component into its own texture and sprite
  const baseImg = scene.textures.get(baseTextureKey).getSourceImage() as
    HTMLImageElement | HTMLCanvasElement;
  if (!baseImg) return [];

  const results: OcclusionObject[] = [];
  const timeId = Date.now().toString(36);

  components.forEach((comp, i) => {
    const cw = comp.maxX - comp.minX + 1;
    const ch = comp.maxY - comp.minY + 1;
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(baseImg, comp.minX, comp.minY, cw, ch, 0, 0, cw, ch);

    const imgData = ctx.getImageData(0, 0, cw, ch);
    const set = new Set(
      comp.pixels.map(([px, py]) => `${px - comp.minX},${py - comp.minY}`)
    );

    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        if (!set.has(`${cx},${cy}`)) {
          imgData.data[(cy * cw + cx) * 4 + 3] = 0;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texKey = `auto_depth_${timeId}_${i}`;
    scene.textures.addCanvas(texKey, canvas);

    const sprite = scene.add.sprite(
      worldX + comp.minX,
      worldY + comp.minY,
      texKey
    );
    sprite.setOrigin(0, 0);
    sprite.setDepth(worldY + comp.baseY);

    results.push({
      sprite,
      textureKey: texKey,
      baseY: worldY + comp.baseY,
    });
  });

  return results;
}

export function destroyOcclusionObjects(
  scene: Phaser.Scene,
  objects: OcclusionObject[]
): void {
  for (const obj of objects) {
    obj.sprite.destroy();
    if (scene.textures.exists(obj.textureKey)) {
      scene.textures.remove(obj.textureKey);
    }
  }
}
