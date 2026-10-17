export type MaterialClass =
  | "void"
  | "road"
  | "grass"
  | "solid"
  | "roof"
  | "canopy"
  | "water"
  | "cliff"
  | "cloth"
  | "fire";

export interface MaterialDef {
  class: MaterialClass;
  rgb: [number, number, number];
  hex: string;
  walkable: boolean;
  notes: string;
}

export const MATERIAL_PALETTE: Record<MaterialClass, MaterialDef> = {
  void: {
    class: "void",
    rgb: [255, 0, 255],
    hex: "#ff00ff",
    walkable: false,
    notes: "outside island",
  },
  road: {
    class: "road",
    rgb: [255, 255, 255],
    hex: "#ffffff",
    walkable: true,
    notes: "dirt/cobble/stairs/bridges",
  },
  grass: {
    class: "grass",
    rgb: [0, 200, 0],
    hex: "#00c800",
    walkable: true,
    notes: "walkable ground",
  },
  solid: {
    class: "solid",
    rgb: [255, 0, 0],
    hex: "#ff0000",
    walkable: false,
    notes: "walls/fences/trunks",
  },
  roof: {
    class: "roof",
    rgb: [255, 128, 0],
    hex: "#ff8000",
    walkable: false,
    notes: "roofs/upper building",
  },
  canopy: {
    class: "canopy",
    rgb: [0, 80, 0],
    hex: "#005000",
    walkable: true,
    notes: "tree crowns/bushes",
  },
  water: {
    class: "water",
    rgb: [0, 0, 255],
    hex: "#0000ff",
    walkable: false,
    notes: "waterfalls/streams",
  },
  cliff: {
    class: "cliff",
    rgb: [128, 64, 0],
    hex: "#804000",
    walkable: false,
    notes: "island edge/underside",
  },
  cloth: {
    class: "cloth",
    rgb: [255, 255, 0],
    hex: "#ffff00",
    walkable: false,
    notes: "banners/flags",
  },
  fire: {
    class: "fire",
    rgb: [255, 0, 128],
    hex: "#ff0080",
    walkable: false,
    notes: "forge fire/lamps",
  },
};

const PALETTE_ENTRIES = Object.values(MATERIAL_PALETTE);

export function matchMaterialColor(
  r: number,
  g: number,
  b: number,
  a = 255
): MaterialClass {
  if (a < 128) return "void";

  let bestClass: MaterialClass = "void";
  let minDiff = Infinity;

  for (const entry of PALETTE_ENTRIES) {
    const dr = r - entry.rgb[0];
    const dg = g - entry.rgb[1];
    const db = b - entry.rgb[2];
    const diff = dr * dr + dg * dg + db * db;
    if (diff < minDiff) {
      minDiff = diff;
      bestClass = entry.class;
    }
  }

  return bestClass;
}

export function buildWalkGrid(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): { grid: Uint8Array; gw: number; gh: number } {
  const gw = Math.ceil(width / 2);
  const gh = Math.ceil(height / 2);
  const grid = new Uint8Array(gw * gh);

  for (let gy = 0; gy < gh; gy++) {
    const y = Math.min(gy * 2, height - 1);
    for (let gx = 0; gx < gw; gx++) {
      const x = Math.min(gx * 2, width - 1);
      const idx = (y * width + x) * 4;
      const r = pixels[idx] ?? 0;
      const g = pixels[idx + 1] ?? 0;
      const b = pixels[idx + 2] ?? 0;
      const a = pixels[idx + 3] ?? 255;

      const mat = matchMaterialColor(r, g, b, a);
      const def = MATERIAL_PALETTE[mat];
      grid[gy * gw + gx] = def.walkable ? 1 : 0;
    }
  }

  return { grid, gw, gh };
}

export function canWalkFeetBox(
  grid: Uint8Array,
  gw: number,
  gh: number,
  lx: number,
  ly: number,
  width: number,
  height: number
): boolean {
  // Sample 6 points across 10x4 feet box
  const offsets = [
    [-5, -2],
    [0, -2],
    [5, -2],
    [-5, 2],
    [0, 2],
    [5, 2],
  ];

  for (const [ox, oy] of offsets) {
    const px = Math.round(lx + (ox ?? 0));
    const py = Math.round(ly + (oy ?? 0));

    if (px < 0 || px >= width || py < 0 || py >= height) return false;

    const gx = Math.floor(px / 2);
    const gy = Math.floor(py / 2);
    if (gx < 0 || gx >= gw || gy < 0 || gy >= gh) return false;

    if (grid[gy * gw + gx] !== 1) return false;
  }

  return true;
}
