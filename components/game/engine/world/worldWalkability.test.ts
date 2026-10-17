import fs from "fs";
import path from "path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BRIDGES, ISLANDS } from "@/lib/content/world";
import { ENGINE_CONSTANTS } from "../constants";
import {
  computeWorldLayout,
  createBridgeCorridor,
  isPointInCorridor,
  isWalkableMaterial,
  type BridgeCorridor,
  type IslandArtLike,
} from "./bridgeGeometry";

interface IslandData extends IslandArtLike {
  version: number;
  size: { w: number; h: number };
  doors: Array<{ buildingId: string; at: [number, number]; radius: number }>;
  spawns: {
    player?: [number, number];
    mayor?: [number, number];
  };
  anchors: Array<{ id: string; at: [number, number] }>;
}

interface LoadedMaterial {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
  channels: number;
}

describe("World Walkability and Bridge Connectivity (BFS Verification)", () => {
  it("verifies all 6 islands, all mayor spawns, and all doors are reachable from home player spawn", async () => {
    const islandIds = ISLANDS.map((i) => i.id);
    const islandData: Record<string, IslandData> = {};
    const materials: Record<string, LoadedMaterial> = {};
    const islandSizes: Record<string, { w: number; h: number }> = {};

    // 1. Load all six material.png and island.json files using sharp
    for (const id of islandIds) {
      const jsonPath = path.resolve(
        process.cwd(),
        `public/game/islands/${id}/island.json`
      );
      const matPath = path.resolve(
        process.cwd(),
        `public/game/islands/${id}/material.png`
      );

      const parsedJson = JSON.parse(
        fs.readFileSync(jsonPath, "utf-8")
      ) as IslandData;
      islandData[id] = parsedJson;
      islandSizes[id] = parsedJson.size;

      const raw = await sharp(matPath)
        .raw()
        .toBuffer({ resolveWithObject: true });

      materials[id] = {
        width: raw.info.width,
        height: raw.info.height,
        data: raw.data,
        channels: raw.info.channels,
      };
    }

    expect(Object.keys(materials)).toHaveLength(6);

    // 2. Apply layout and bridge corridors
    const layoutResult = computeWorldLayout(
      ISLANDS,
      islandSizes,
      ENGINE_CONSTANTS.LAYOUT_SCALE,
      600
    );

    const corridors: BridgeCorridor[] = [];
    for (const bridge of BRIDGES) {
      const fromLayout = layoutResult.islands.get(bridge.from)!;
      const toLayout = layoutResult.islands.get(bridge.to)!;
      const fromArt = islandData[bridge.from]!;
      const toArt = islandData[bridge.to]!;

      const fromAnchor = fromArt.anchors?.find(
        (a) => a.id === `to_${bridge.to}` || a.id === bridge.to
      );
      const toAnchor = toArt.anchors?.find(
        (a) => a.id === `to_${bridge.from}` || a.id === bridge.from
      );

      expect(
        fromAnchor,
        `Missing anchor on ${bridge.from} to ${bridge.to}`
      ).toBeDefined();
      expect(
        toAnchor,
        `Missing anchor on ${bridge.to} to ${bridge.from}`
      ).toBeDefined();

      const start = {
        x: fromLayout.worldX + fromAnchor!.at[0],
        y: fromLayout.worldY + fromAnchor!.at[1],
      };
      const end = {
        x: toLayout.worldX + toAnchor!.at[0],
        y: toLayout.worldY + toAnchor!.at[1],
      };

      const corridor = createBridgeCorridor({
        fromIslandId: bridge.from,
        toIslandId: bridge.to,
        style: bridge.style ?? "rope",
        start,
        end,
        width: ENGINE_CONSTANTS.BRIDGE.CORRIDOR_WIDTH,
        overlap: ENGINE_CONSTANTS.BRIDGE.OVERLAP,
      });

      corridors.push(corridor);
    }

    expect(corridors).toHaveLength(BRIDGES.length);

    // 3. Build combined world walk grid at 2px resolution
    const RES = 2;
    const totalW = layoutResult.bounds.width;
    const totalH = layoutResult.bounds.height;
    const gw = Math.ceil(totalW / RES);
    const gh = Math.ceil(totalH / RES);
    const walkGrid = new Uint8Array(gw * gh);

    // Helper: is material pixel walkable (road or grass)
    function isPixelWalkable(
      mat: LoadedMaterial,
      x: number,
      y: number
    ): boolean {
      if (x < 0 || x >= mat.width || y < 0 || y >= mat.height) return false;
      const idx = (y * mat.width + x) * mat.channels;
      const r = mat.data[idx] ?? 0;
      const g = mat.data[idx + 1] ?? 0;
      const b = mat.data[idx + 2] ?? 0;
      return isWalkableMaterial(r, g, b);
    }

    // Helper: is world point in any bridge corridor
    function isPointInAnyCorridor(wx: number, wy: number): boolean {
      for (let i = 0; i < corridors.length; i++) {
        if (isPointInCorridor(corridors[i]!, wx, wy)) {
          return true;
        }
      }
      return false;
    }

    // Populate island walkables onto world grid
    for (const id of islandIds) {
      const mat = materials[id]!;
      const layout = layoutResult.islands.get(id)!;

      for (let ly = 0; ly < mat.height; ly++) {
        for (let lx = 0; lx < mat.width; lx++) {
          if (isPixelWalkable(mat, lx, ly)) {
            const wx = layout.worldX + lx;
            const wy = layout.worldY + ly;
            const gx = Math.floor(wx / RES);
            const gy = Math.floor(wy / RES);
            if (gx >= 0 && gx < gw && gy >= 0 && gy < gh) {
              walkGrid[gy * gw + gx] = 1;
            }
          }
        }
      }
    }

    // Populate bridge corridors onto world grid
    for (const corridor of corridors) {
      const minX = Math.floor(
        (Math.min(corridor.start.x, corridor.end.x) - 20) / RES
      );
      const maxX = Math.ceil(
        (Math.max(corridor.start.x, corridor.end.x) + 20) / RES
      );
      const minY = Math.floor(
        (Math.min(corridor.start.y, corridor.end.y) - 20) / RES
      );
      const maxY = Math.ceil(
        (Math.max(corridor.start.y, corridor.end.y) + 20) / RES
      );

      for (let gy = Math.max(0, minY); gy <= Math.min(gh - 1, maxY); gy++) {
        const wy = gy * RES;
        for (let gx = Math.max(0, minX); gx <= Math.min(gw - 1, maxX); gx++) {
          const wx = gx * RES;
          if (isPointInCorridor(corridor, wx, wy)) {
            walkGrid[gy * gw + gx] = 1;
          }
        }
      }
    }

    // 4. BFS walk from Home spawns.player
    const homeLayout = layoutResult.islands.get("home")!;
    const homePlayerSpawn = islandData.home!.spawns.player!;
    const startWX = homeLayout.worldX + homePlayerSpawn[0];
    const startWY = homeLayout.worldY + homePlayerSpawn[1];
    const startGX = Math.floor(startWX / RES);
    const startGY = Math.floor(startWY / RES);

    expect(
      walkGrid[startGY * gw + startGX],
      "Home player spawn must land on walkable ground"
    ).toBe(1);

    const visited = new Uint8Array(gw * gh);
    const queue = [startGY * gw + startGX];
    visited[startGY * gw + startGX] = 1;

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++]!;
      const cx = curr % gw;
      const cy = Math.floor(curr / gw);

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cx + dx!;
        const ny = cy + dy!;
        if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) {
          const nidx = ny * gw + nx;
          if (!visited[nidx] && walkGrid[nidx] === 1) {
            visited[nidx] = 1;
            queue.push(nidx);
          }
        }
      }
    }

    // Assert that a substantial portion of the world is reachable
    expect(queue.length).toBeGreaterThan(50000);

    // 5. Assert: Every island is reached (has visited walkable cells)
    for (const id of islandIds) {
      const layout = layoutResult.islands.get(id)!;
      let islandVisitedCells = 0;
      const startX = Math.floor(layout.worldX / RES);
      const endX = Math.ceil((layout.worldX + layout.width) / RES);
      const startY = Math.floor(layout.worldY / RES);
      const endY = Math.ceil((layout.worldY + layout.height) / RES);

      for (let gy = startY; gy <= endY; gy++) {
        for (let gx = startX; gx <= endX; gx++) {
          if (visited[gy * gw + gx] === 1) {
            islandVisitedCells++;
          }
        }
      }

      expect(
        islandVisitedCells,
        `Island "${id}" must be reachable from home via walkable bridges`
      ).toBeGreaterThan(100);
    }

    // 6. Assert: Every mayor spawn is reached by BFS
    for (const id of islandIds) {
      const mayorSpawn = islandData[id]!.spawns.mayor;
      if (!mayorSpawn) continue;

      const layout = layoutResult.islands.get(id)!;
      const mwx = layout.worldX + mayorSpawn[0];
      const mwy = layout.worldY + mayorSpawn[1];
      const mgx = Math.floor(mwx / RES);
      const mgy = Math.floor(mwy / RES);

      // Mayor reached directly or within 1 grid cell (2px)
      let mayorReached = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (visited[(mgy + dy) * gw + (mgx + dx)] === 1) {
            mayorReached = true;
            break;
          }
        }
        if (mayorReached) break;
      }

      expect(
        mayorReached,
        `Mayor on island "${id}" at [${mayorSpawn[0]}, ${mayorSpawn[1]}] must be reachable from home`
      ).toBe(true);
    }

    // 7. Assert: Every door on every island is reachable within door.radius
    for (const id of islandIds) {
      const layout = layoutResult.islands.get(id)!;
      for (const door of islandData[id]!.doors) {
        const dwx = layout.worldX + door.at[0];
        const dwy = layout.worldY + door.at[1];
        const rGrid = Math.ceil(door.radius / RES);
        const dgx = Math.floor(dwx / RES);
        const dgy = Math.floor(dwy / RES);

        let doorReached = false;
        for (let dy = -rGrid; dy <= rGrid; dy++) {
          for (let dx = -rGrid; dx <= rGrid; dx++) {
            const gx = dgx + dx;
            const gy = dgy + dy;
            if (
              gx >= 0 &&
              gx < gw &&
              gy >= 0 &&
              gy < gh &&
              visited[gy * gw + gx] === 1
            ) {
              const dist = Math.hypot(gx * RES - dwx, gy * RES - dwy);
              if (dist <= door.radius) {
                doorReached = true;
                break;
              }
            }
          }
          if (doorReached) break;
        }

        expect(
          doorReached,
          `Door "${door.buildingId}" on island "${id}" at [${door.at[0]}, ${door.at[1]}] must be reachable within radius ${door.radius}`
        ).toBe(true);
      }
    }

    // 8. Assert: Edge sealing - no walkable cell touches void outside a bridge corridor
    function isPixelVoid(mat: LoadedMaterial, x: number, y: number): boolean {
      if (x < 0 || x >= mat.width || y < 0 || y >= mat.height) return true;
      const idx = (y * mat.width + x) * mat.channels;
      const a = mat.channels >= 4 ? (mat.data[idx + 3] ?? 255) : 255;
      if (a < 128) return true;
      const r = mat.data[idx] ?? 0;
      const g = mat.data[idx + 1] ?? 0;
      const b = mat.data[idx + 2] ?? 0;
      return r > 200 && b > 200 && g < 50; // Chroma key magenta
    }

    let unsealedVoidNeighbors = 0;
    for (const id of islandIds) {
      const mat = materials[id]!;
      const layout = layoutResult.islands.get(id)!;

      for (let ly = 0; ly < mat.height; ly++) {
        for (let lx = 0; lx < mat.width; lx++) {
          if (isPixelWalkable(mat, lx, ly)) {
            // Check 4 cardinal neighbors
            for (const [dx, dy] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const nx = lx + dx!;
              const ny = ly + dy!;
              if (isPixelVoid(mat, nx, ny)) {
                const wx = layout.worldX + nx;
                const wy = layout.worldY + ny;
                // If not in a bridge corridor, this void point must NOT be walkable in the world
                const inCorridor = isPointInAnyCorridor(wx, wy);
                if (!inCorridor) {
                  // Check if any other island considers (wx, wy) walkable
                  for (const otherId of islandIds) {
                    if (otherId === id) continue;
                    const otherMat = materials[otherId]!;
                    const otherLayout = layoutResult.islands.get(otherId)!;
                    const olx = wx - otherLayout.worldX;
                    const oly = wy - otherLayout.worldY;
                    if (isPixelWalkable(otherMat, olx, oly)) {
                      unsealedVoidNeighbors++;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(
      unsealedVoidNeighbors,
      "No island boundary cell should leak into void or overlap with another island outside bridge corridors"
    ).toBe(0);
  });
});
