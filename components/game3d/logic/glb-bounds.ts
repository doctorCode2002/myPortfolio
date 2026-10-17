/**
 * Model-space bounds of a .glb read straight from its JSON chunk (POSITION accessor
 * min/max through the node hierarchy), without three or a full parse. Used to place
 * colliders for models whose geometry is offset from their origin (hex-edge fences and
 * walls sit on a hex edge, not at its centre). Pure.
 */

export type ModelBounds = {
  min: [number, number, number];
  max: [number, number, number];
};

type GltfNode = {
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
};

type Gltf = {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: GltfNode[];
  meshes?: { primitives: { attributes: Record<string, number> }[] }[];
  accessors?: {
    min?: number[];
    max?: number[];
    normalized?: boolean;
    componentType?: number;
  }[];
};

type Mat4 = number[];

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++)
        s += (a[k * 4 + r] as number) * (b[c * 4 + k] as number);
      out[c * 4 + r] = s;
    }
  return out;
}

function compose(n: GltfNode): Mat4 {
  if (n.matrix && n.matrix.length === 16) return n.matrix.slice();
  const [tx, ty, tz] = (n.translation ?? [0, 0, 0]) as [number, number, number];
  const [x, y, z, w] = (n.rotation ?? [0, 0, 0, 1]) as [
    number,
    number,
    number,
    number,
  ];
  const [sx, sy, sz] = (n.scale ?? [1, 1, 1]) as [number, number, number];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

/** Divisor for normalized integer accessors (KHR_mesh_quantization). */
function normScale(componentType: number | undefined): number {
  switch (componentType) {
    case 5120:
      return 127;
    case 5121:
      return 255;
    case 5122:
      return 32767;
    case 5123:
      return 65535;
    default:
      return 1;
  }
}

/** Parse the JSON chunk of a GLB container. */
export function readGlbJson(buffer: ArrayBuffer): Gltf | null {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67)
    return null;
  const len = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a) return null;
  const bytes = new Uint8Array(buffer, 20, len);
  return JSON.parse(new TextDecoder().decode(bytes)) as Gltf;
}

export function gltfBounds(gltf: Gltf): ModelBounds | null {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const nodes = gltf.nodes ?? [];
  const visit = (index: number, parent: Mat4): void => {
    const node = nodes[index];
    if (!node) return;
    const m = multiply(parent, compose(node));
    if (node.mesh !== undefined) {
      for (const prim of gltf.meshes?.[node.mesh]?.primitives ?? []) {
        const acc = gltf.accessors?.[prim.attributes["POSITION"] ?? -1];
        if (!acc?.min || !acc.max) continue;
        const k = acc.normalized ? normScale(acc.componentType) : 1;
        const lo = acc.min.map((v) => v / k);
        const hi = acc.max.map((v) => v / k);
        for (let i = 0; i < 8; i++) {
          const p = [
            i & 1 ? hi[0] : lo[0],
            i & 2 ? hi[1] : lo[1],
            i & 4 ? hi[2] : lo[2],
          ] as number[];
          for (let a = 0; a < 3; a++) {
            const v =
              (m[a] as number) * (p[0] as number) +
              (m[4 + a] as number) * (p[1] as number) +
              (m[8 + a] as number) * (p[2] as number) +
              (m[12 + a] as number);
            min[a] = Math.min(min[a] as number, v);
            max[a] = Math.max(max[a] as number, v);
          }
        }
      }
    }
    for (const c of node.children ?? []) visit(c, m);
  };
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const roots = gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? nodes.map((_, i) => i);
  for (const r of roots) visit(r, identity);
  return Number.isFinite(min[0]) ? { min, max } : null;
}

export function glbBounds(buffer: ArrayBuffer): ModelBounds | null {
  const json = readGlbJson(buffer);
  return json ? gltfBounds(json) : null;
}
