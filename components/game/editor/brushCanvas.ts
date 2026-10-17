export class MaterialHistory {
  private undoStack: ImageData[] = [];
  private redoStack: ImageData[] = [];
  private maxDepth = 20;

  public push(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.undoStack.push(snap);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(canvas: HTMLCanvasElement): boolean {
    if (this.undoStack.length === 0) return false;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;

    // Save current to redo
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.redoStack.push(current);

    const prev = this.undoStack.pop()!;
    ctx.putImageData(prev, 0, 0);
    return true;
  }

  public redo(canvas: HTMLCanvasElement): boolean {
    if (this.redoStack.length === 0) return false;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;

    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.undoStack.push(current);

    const next = this.redoStack.pop()!;
    ctx.putImageData(next, 0, 0);
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}

export function paintBrush(
  canvas: HTMLCanvasElement,
  cx: number,
  cy: number,
  brushSize: number,
  rgb: [number, number, number]
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const [r, g, b] = rgb;
  ctx.fillStyle = `rgb(${r},${g},${b})`;

  if (brushSize <= 1) {
    ctx.fillRect(Math.floor(cx), Math.floor(cy), 1, 1);
  } else {
    const radius = brushSize / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function floodFill(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  targetRGB: [number, number, number]
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const startIdx = (sy * w + sx) * 4;
  const startR = data[startIdx] ?? 0;
  const startG = data[startIdx + 1] ?? 0;
  const startB = data[startIdx + 2] ?? 0;

  const [tr, tg, tb] = targetRGB;
  if (startR === tr && startG === tg && startB === tb) return;

  const matchesStart = (idx: number): boolean => {
    return (
      Math.abs((data[idx] ?? 0) - startR) < 15 &&
      Math.abs((data[idx + 1] ?? 0) - startG) < 15 &&
      Math.abs((data[idx + 2] ?? 0) - startB) < 15
    );
  };

  const queue = new Int32Array(w * h * 2);
  let qHead = 0;
  let qTail = 0;

  queue[qTail++] = sx;
  queue[qTail++] = sy;

  const visited = new Uint8Array(w * h);
  visited[sy * w + sx] = 1;

  while (qHead < qTail) {
    const x = queue[qHead++];
    const y = queue[qHead++];
    if (x === undefined || y === undefined) break;

    const idx = (y * w + x) * 4;
    data[idx] = tr;
    data[idx + 1] = tg;
    data[idx + 2] = tb;
    data[idx + 3] = 255;

    // Check 4 neighbors
    const n = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of n) {
      if (nx! >= 0 && nx! < w && ny! >= 0 && ny! < h) {
        const vIdx = ny! * w + nx!;
        if (visited[vIdx] === 0) {
          visited[vIdx] = 1;
          const pIdx = vIdx * 4;
          if (matchesStart(pIdx)) {
            queue[qTail++] = nx!;
            queue[qTail++] = ny!;
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
