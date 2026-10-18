"use client";

/**
 * The physics side of the car (lazy: this module pulls in @react-three/rapier and the
 * Rapier WASM, so walking visitors never download it). It simulates only what needs real
 * physics: the low-poly chunks of smashed props, tumbling on static colliders built for
 * the islands near the car (terrain hex prisms, buildings and other solid obstacles, the
 * rim and bridge rails, the bridge decks), pushed by a kinematic body that mirrors the
 * car. Islands' colliders are created and destroyed as the car moves.
 */

import { useFrame } from "@react-three/fiber";
import { Physics, useBeforePhysicsStep, useRapier } from "@react-three/rapier";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { CAR } from "../logic/car";
import type { Rail } from "../logic/rails";
import {
  cellAtWorld,
  cellHeightAt,
  type IslandWalkGrid,
} from "../logic/walk-grid";
import { bridgeHeightAt, type BridgeCorridor } from "../logic/walk-world";
import type { GameWorld } from "../logic/world-layout";
import { useRuntimeRef, type BreakEvent } from "../runtime";

type RapierApi = ReturnType<typeof useRapier>;
type PWorld = RapierApi["world"];
type Rapier = RapierApi["rapier"];
type Body = ReturnType<PWorld["createRigidBody"]>;

/** Chunk cap (mobile friendly); the oldest go first. */
export const MAX_CHUNKS = 60;
const CHUNK_LIFE = 3;
const CHUNK_FADE = 0.7;
/** Islands get colliders within this gap (metres from their rim) and lose them beyond the second. */
const BUILD_RANGE = 18;
const DROP_RANGE = 32;

type Chunk = {
  body: Body;
  half: [number, number, number];
  color: THREE.Color;
  born: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpR = new THREE.Quaternion();

function yawQuat(yaw: number): { x: number; y: number; z: number; w: number } {
  tmpQ.setFromAxisAngle(UP, yaw);
  return { x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w };
}

/** A thin wall along a rail segment. */
function railCollider(
  rapier: Rapier,
  r: Rail
): ReturnType<Rapier["ColliderDesc"]["cuboid"]> {
  const dx = r.bx - r.ax;
  const dz = r.bz - r.az;
  const len = Math.hypot(dx, dz);
  return rapier.ColliderDesc.cuboid(0.05, (r.y1 - r.y0) / 2, len / 2 + 0.02)
    .setTranslation((r.ax + r.bx) / 2, (r.y0 + r.y1) / 2, (r.az + r.bz) / 2)
    .setRotation(yawQuat(Math.atan2(dx, dz)))
    .setFriction(0.6);
}

/** Static colliders of one island: a hex prism per tile, solid obstacles, rim rails. */
function buildIsland(
  pw: PWorld,
  rapier: Rapier,
  world: GameWorld,
  grid: IslandWalkGrid
): Body {
  const body = pw.createRigidBody(rapier.RigidBodyDesc.fixed());
  for (const cell of grid.cells.values()) {
    const top =
      cell.water && !cell.deck
        ? cell.y - 0.15
        : cell.blocked
          ? cell.y + 2.5
          : 0;
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      const x = cell.x + Math.cos(a) * grid.size;
      const z = cell.z + Math.sin(a) * grid.size;
      const y = top || cellHeightAt(cell, x, z, grid.hexWidth);
      pts.push(x, y, z, x, cell.y - 1.2, z);
    }
    const desc = rapier.ColliderDesc.convexHull(new Float32Array(pts));
    if (desc)
      pw.createCollider(desc.setFriction(0.9).setRestitution(0.1), body);
  }
  for (const o of grid.obstacles) {
    if (o.key && world.props.has(o.key)) continue; // breakables: no collider
    const cy = (cellAtWorld(grid, o.x, o.z)?.y ?? grid.baseY) + 1;
    const desc =
      o.shape === "circle"
        ? rapier.ColliderDesc.cylinder(1, o.radius).setTranslation(o.x, cy, o.z)
        : rapier.ColliderDesc.cuboid(o.hx, 1, o.hz)
            .setTranslation(o.x, cy, o.z)
            .setRotation(yawQuat(o.rot));
    pw.createCollider(desc.setFriction(0.7), body);
  }
  for (const r of world.rails)
    if (r.kind === "rim" && r.owner === grid.islandId)
      pw.createCollider(railCollider(rapier, r), body);
  return body;
}

/** A bridge's deck (as segments that follow its arch) and its side rails. */
function buildBridge(
  pw: PWorld,
  rapier: Rapier,
  world: GameWorld,
  b: BridgeCorridor
): Body {
  const body = pw.createRigidBody(rapier.RigidBodyDesc.fixed());
  const dx = b.b.x - b.a.x;
  const dz = b.b.z - b.a.z;
  const n = Math.max(2, Math.ceil(b.length / 1.2));
  const yaw = yawQuat(Math.atan2(dx, dz));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const y = bridgeHeightAt(b, t);
    pw.createCollider(
      rapier.ColliderDesc.cuboid(b.halfWidth, 0.1, b.length / n / 2 + 0.05)
        .setTranslation(b.a.x + dx * t, y - 0.1, b.a.z + dz * t)
        .setRotation(yaw)
        .setFriction(0.9),
      body
    );
  }
  for (const r of world.rails)
    if (r.kind === "bridge" && r.owner === b.id)
      pw.createCollider(railCollider(rapier, r), body);
  return body;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** Shatter a smashed prop into 4-8 tumbling low-poly chunks (the oldest go past the cap). */
function spawnChunks(
  pw: PWorld,
  rapier: Rapier,
  list: Chunk[],
  ev: BreakEvent,
  now: number
): void {
  const vol = ev.size[0] * ev.size[1] * ev.size[2];
  const n = ev.tall ? 6 : Math.max(4, Math.min(8, Math.round(3 + vol * 8)));
  while (list.length + n > MAX_CHUNKS) {
    const old = list.shift();
    if (old) pw.removeRigidBody(old.body);
  }
  const speed = Math.hypot(ev.vx, ev.vz) || 1;
  const ux = ev.vx / speed;
  const uz = ev.vz / speed;
  const base = Math.max(0.06, Math.min(0.18, Math.cbrt(vol / n) * 0.36));
  for (let i = 0; i < n; i++) {
    const pole = ev.tall && i === 0;
    const half: [number, number, number] = pole
      ? [
          Math.max(0.06, Math.min(0.14, ev.size[0] * 0.12)),
          ev.size[1] * 0.28,
          Math.max(0.06, Math.min(0.14, ev.size[2] * 0.12)),
        ]
      : [base * rand(0.7, 1.3), base * rand(0.6, 1.2), base * rand(0.7, 1.3)];
    const ox = pole ? 0 : rand(-0.35, 0.35) * ev.size[0];
    const oz = pole ? 0 : rand(-0.35, 0.35) * ev.size[2];
    const oy = pole ? half[1] + 0.02 : ev.size[1] * rand(0.25, 0.85) + half[1];
    const desc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(ev.x + ox, ev.y + oy, ev.z + oz)
      .setRotation(yawQuat(ev.rotY + rand(-0.4, 0.4)))
      .setLinearDamping(0.15)
      .setAngularDamping(0.35)
      .setCanSleep(true);
    const body = pw.createRigidBody(desc);
    pw.createCollider(
      rapier.ColliderDesc.cuboid(half[0], half[1], half[2])
        .setDensity(0.6)
        .setFriction(0.8)
        .setRestitution(0.2),
      body
    );
    const push = Math.min(speed, 16);
    if (pole) {
      // Topple: tip over away from the car.
      body.setLinvel({ x: ux * push * 0.3, y: 1.2, z: uz * push * 0.3 }, true);
      body.setAngvel({ x: uz * 4.5, y: 0, z: -ux * 4.5 }, true);
    } else {
      const r = Math.hypot(ox, oz) || 1;
      body.setLinvel(
        {
          x: ux * push * rand(0.4, 0.7) + (ox / r) * rand(0.8, 2),
          y: rand(2, 4.5),
          z: uz * push * rand(0.4, 0.7) + (oz / r) * rand(0.8, 2),
        },
        true
      );
      body.setAngvel({ x: rand(-6, 6), y: rand(-6, 6), z: rand(-6, 6) }, true);
    }
    const pal = ev.palette;
    const hex = pole
      ? (pal[0] ?? "#7a5236")
      : (pal[
          ev.tall
            ? 1 + Math.floor(Math.random() * (pal.length - 1))
            : Math.floor(Math.random() * pal.length)
        ] ?? "#a8693f");
    list.push({
      body,
      half,
      color: new THREE.Color(hex),
      born: now,
    });
  }
}

function PhysicsContents({ world }: { world: GameWorld }): ReactNode {
  const rtRef = useRuntimeRef();
  const { rapier } = useRapier();
  const islands = useRef(new Map<string, Body>());
  const bridges = useRef(new Map<string, Body>());
  const chunks = useRef<Chunk[]>([]);
  const carBody = useRef<Body | null>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const frame = useRef(0);
  const time = useRef(0);

  const extents = useMemo(
    () =>
      world.walk.islands.map((g) => {
        let r = 0;
        for (const c of g.cells.values())
          r = Math.max(r, Math.hypot(c.x - g.origin.x, c.z - g.origin.z));
        return { grid: g, radius: r + g.size };
      }),
    [world]
  );

  const builtFor = useRef<GameWorld | null>(null);

  // Every world mutation happens inside the physics step callback, never in React effects:
  // under StrictMode the provider frees and recreates its world around the effect double
  // run, and bodies made in between corrupt it. The provider frees everything on unmount.
  useBeforePhysicsStep((pworld) => {
    const rt = rtRef.current;
    const car = rt.car.state;

    // The car's kinematic stand-in (pushes chunks around).
    let body = carBody.current;
    if (!body) {
      body = pworld.createRigidBody(
        rapier.RigidBodyDesc.kinematicPositionBased()
      );
      pworld.createCollider(
        rapier.ColliderDesc.cuboid(CAR.width / 2, 0.3, CAR.length / 2)
          .setTranslation(0, 0.42, 0)
          .setFriction(0.4),
        body
      );
      carBody.current = body;
    }
    if (car) {
      body.setNextKinematicTranslation({ x: car.x, y: car.y, z: car.z });
      tmpE.set(-car.pitch, car.heading, car.roll, "YXZ");
      tmpR.setFromEuler(tmpE);
      body.setNextKinematicRotation({
        x: tmpR.x,
        y: tmpR.y,
        z: tmpR.z,
        w: tmpR.w,
      });
    }

    // A world rebuild (manifest, bounds) invalidates the island colliders.
    if (builtFor.current !== world) {
      for (const b of islands.current.values()) pworld.removeRigidBody(b);
      for (const b of bridges.current.values()) pworld.removeRigidBody(b);
      islands.current.clear();
      bridges.current.clear();
      builtFor.current = world;
      frame.current = 0;
    }

    // Stream island and bridge colliders around the car (or the player on foot).
    if (frame.current++ % 20 === 0) {
      const cx = car && rt.car.driving ? car.x : rt.player.pos.x;
      const cz = car && rt.car.driving ? car.z : rt.player.pos.z;
      for (const { grid, radius } of extents) {
        const gap = Math.hypot(cx - grid.origin.x, cz - grid.origin.z) - radius;
        const built = islands.current.get(grid.islandId);
        if (gap < BUILD_RANGE && !built)
          islands.current.set(
            grid.islandId,
            buildIsland(pworld, rapier, world, grid)
          );
        else if (gap > DROP_RANGE && built) {
          pworld.removeRigidBody(built);
          islands.current.delete(grid.islandId);
        }
      }
      for (const b of world.walk.bridges) {
        const want = islands.current.has(b.from) || islands.current.has(b.to);
        const built = bridges.current.get(b.id);
        if (want && !built)
          bridges.current.set(b.id, buildBridge(pworld, rapier, world, b));
        else if (!want && built) {
          pworld.removeRigidBody(built);
          bridges.current.delete(b.id);
        }
      }
    }

    // New smashes, and retired chunks.
    if (rt.breaks.length)
      for (const ev of rt.breaks.splice(0))
        spawnChunks(pworld, rapier, chunks.current, ev, time.current);
    const list = chunks.current;
    let w = 0;
    for (const c of list) {
      const age = time.current - c.born;
      if (age > CHUNK_LIFE || c.body.translation().y < -60)
        pworld.removeRigidBody(c.body);
      else list[w++] = c;
    }
    list.length = w;
  });

  // Draw the chunks (fading by shrinking over their last moments).
  useFrame((_, rawDt) => {
    time.current += Math.min(rawDt, 0.1);
    const list = chunks.current;
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < list.length; i++) {
      const c = list[i] as Chunk;
      const age = time.current - c.born;
      const k =
        age > CHUNK_LIFE - CHUNK_FADE
          ? Math.max(0.001, (CHUNK_LIFE - age) / CHUNK_FADE)
          : 1;
      const t = c.body.translation();
      const r = c.body.rotation();
      tmpP.set(t.x, t.y, t.z);
      tmpQ.set(r.x, r.y, r.z, r.w);
      tmpS.set(c.half[0] * k, c.half[1] * k, c.half[2] * k);
      tmpM.compose(tmpP, tmpQ, tmpS);
      m.setMatrixAt(i, tmpM);
      m.setColorAt(i, c.color);
    }
    m.count = list.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  const geometry = useMemo(() => new THREE.BoxGeometry(2, 2, 2), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85 }),
    []
  );
  // Allocate the colour buffer up front (setColorAt creates it lazily otherwise).
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const white = new THREE.Color("#ffffff");
    for (let i = 0; i < MAX_CHUNKS; i++) m.setColorAt(i, white);
    m.count = 0;
  }, []);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, MAX_CHUNKS]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
}

/** Default export for React.lazy. */
export default function CarPhysics({ world }: { world: GameWorld }): ReactNode {
  return (
    <Physics
      timeStep={1 / 60}
      gravity={[0, -20, 0]}
      colliders={false}
      interpolate={false}
    >
      <PhysicsContents world={world} />
    </Physics>
  );
}
