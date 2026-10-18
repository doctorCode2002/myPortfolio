"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { atmosphere } from "../atmosphere/store";
import { waterfallAnchors } from "../atmosphere/anchors";
import { CAR } from "../logic/car";
import { surfaceAt } from "../logic/walk-world";
import type { GameWorld } from "../logic/world-layout";
import { useRuntimeRef } from "../runtime";
import {
  footstepSurface,
  musicForIsland,
  MUSIC_TRACKS,
  pavedHexes,
  type FootSurface,
  type MusicTrack,
} from "./mix";
import { onSoundCue } from "./sound-store";
import { playChime } from "../meta/chime";

const BASE = "/game3d/audio/";
const STEP_FILES: Record<FootSurface, string[]> = {
  grass: ["step-grass-0", "step-grass-1", "step-grass-2"],
  path: ["step-snow-0", "step-snow-1", "step-snow-2"],
  wood: ["step-wood-0", "step-wood-1", "step-wood-2"],
  stone: ["step-concrete-0", "step-concrete-1", "step-concrete-2"],
};
const IMPACTS = ["impact-0", "impact-1", "impact-2"];
/** Metres per footstep at walking speed. */
const STRIDE = 0.7;

type Loop = { gain: GainNode; src: AudioBufferSourceNode | null };

/**
 * Loop points that skip the encoder's silent padding at either end of an mp3, so loops
 * stay seamless in every browser.
 */
function loopBounds(buf: AudioBuffer): [number, number] {
  const d = buf.getChannelData(0);
  const eps = 1e-4;
  let a = 0;
  while (a < d.length && Math.abs(d[a] ?? 0) < eps) a++;
  let b = d.length - 1;
  while (b > a && Math.abs(d[b] ?? 0) < eps) b--;
  return [a / buf.sampleRate, (b + 1) / buf.sampleRate];
}

class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loops = new Map<string, Loop>();
  private waterfalls: { panner: PannerNode; gain: GainNode }[] = [];
  private closed = false;

  /** True once close() has been called (the context may still be shutting down). */
  get isClosed(): boolean {
    return this.closed;
  }

  constructor() {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.8);
  }

  async load(name: string): Promise<AudioBuffer | null> {
    const have = this.buffers.get(name);
    if (have) return have;
    try {
      const res = await fetch(`${BASE}${name}.mp3`);
      if (!res.ok) return null;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      if (this.closed) return null;
      this.buffers.set(name, buf);
      return buf;
    } catch {
      return null;
    }
  }

  /** A looping bed with its own gain (starts silent; the mixer sets its level). */
  loop(name: string, out: AudioNode = this.master): Loop {
    const existing = this.loops.get(name);
    if (existing) return existing;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(out);
    const entry: Loop = { gain, src: null };
    this.loops.set(name, entry);
    void this.load(name).then((buf) => {
      if (!buf || this.closed) return;
      entry.src = this.startLoop(buf, gain, Math.random());
    });
    return entry;
  }

  private startLoop(
    buf: AudioBuffer,
    out: AudioNode,
    offset: number
  ): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const [a, b] = loopBounds(buf);
    src.loopStart = a;
    src.loopEnd = b;
    src.connect(out);
    src.start(0, a + offset * (b - a));
    return src;
  }

  /** One looping source per waterfall, positioned with distance falloff. */
  addWaterfalls(spots: readonly { x: number; y: number; z: number }[]): void {
    void this.load("waterfall").then((buf) => {
      if (!buf || this.closed) return;
      for (const s of spots) {
        const panner = this.ctx.createPanner();
        panner.panningModel = "equalpower";
        panner.distanceModel = "inverse";
        panner.refDistance = 3;
        panner.maxDistance = 70;
        panner.rolloffFactor = 1.3;
        panner.positionX.value = s.x;
        panner.positionY.value = s.y;
        panner.positionZ.value = s.z;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.9;
        panner.connect(gain);
        gain.connect(this.master);
        this.startLoop(buf, panner, Math.random());
        this.waterfalls.push({ panner, gain });
      }
    });
  }

  setLevel(loop: Loop, level: number, tau = 0.6): void {
    loop.gain.gain.setTargetAtTime(level, this.ctx.currentTime, tau);
  }

  setRate(loop: Loop, rate: number): void {
    loop.src?.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.08);
  }

  setWaterfallLevel(level: number): void {
    for (const w of this.waterfalls)
      w.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 1);
  }

  /** A one-shot sample (no-op until it has loaded). */
  play(name: string, gain: number, rate = 1): void {
    const buf = this.buffers.get(name);
    if (!buf) {
      void this.load(name);
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  setListener(cam: THREE.Camera, fwd: THREE.Vector3, up: THREE.Vector3): void {
    const l = this.ctx.listener;
    const p = cam.position;
    if (l.positionX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y;
      l.positionZ.value = p.z;
      l.forwardX.value = fwd.x;
      l.forwardY.value = fwd.y;
      l.forwardZ.value = fwd.z;
      l.upX.value = up.x;
      l.upY.value = up.y;
      l.upZ.value = up.z;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    const ctx = this.ctx;
    if (ctx.state === "closed") return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    window.setTimeout(() => {
      if (ctx.state !== "closed") ctx.close().catch(() => undefined);
    }, 500);
  }
}

/**
 * Ambient sound (loaded only after the visitor turns sound on): music crossfading per
 * island, birdsong by day, crickets at night, wind with the gusts, rain, positioned
 * waterfalls, footsteps by surface, and the car's engine and impacts.
 */
export default function AudioSystem({
  world,
}: {
  world: GameWorld;
}): ReactNode {
  const rtRef = useRuntimeRef();
  const camera = useThree((s) => s.camera);
  const engineRef = useRef<AudioEngine | null>(null);
  const waterfalls = useMemo(() => waterfallAnchors(world), [world]);
  const paved = useMemo(() => pavedHexes(world.islands), [world]);
  const tmp = useMemo(
    () => ({ fwd: new THREE.Vector3(), up: new THREE.Vector3() }),
    []
  );
  const st = useRef({
    stepAcc: 0,
    lastX: 0,
    lastZ: 0,
    music: "meadow" as MusicTrack,
    lastIsland: "home",
    beds: null as null | {
      music: Partial<Record<MusicTrack, Loop>>;
      birds: Loop;
      crickets: Loop;
      wind: Loop;
      rain: Loop;
      engine: Loop;
    },
  });

  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;
    const state = st.current;
    state.beds = {
      // Music beds load on first use (only the current island's track at first).
      music: {},
      birds: engine.loop("birds"),
      crickets: engine.loop("crickets"),
      wind: engine.loop("wind"),
      rain: engine.loop("rain"),
      engine: engine.loop("engine"),
    };
    engine.addWaterfalls(waterfalls);
    for (const list of Object.values(STEP_FILES))
      for (const f of list) void engine.load(f);
    for (const f of IMPACTS) void engine.load(f);
    // Browsers may start the context suspended until a gesture.
    const resume = (): void => {
      // Closing the context (sound off, leaving /play) rejects a pending resume() with
      // InvalidStateError; that's expected, so don't let it surface as an unhandled rejection.
      if (engine.isClosed || engine.ctx.state !== "suspended") return;
      engine.ctx.resume().catch(() => undefined);
    };
    resume();
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __audio?: unknown }).__audio = engine;
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    let lastImpact = 0;
    const offCue = onSoundCue((cue) => {
      if (cue.kind === "chime") {
        playChime(engine.ctx, engine.master, cue.strength, cue.pitch);
        return;
      }
      if (cue.kind !== "impact") return;
      const now = performance.now();
      if (now - lastImpact < 140) return;
      lastImpact = now;
      const name = IMPACTS[Math.floor(Math.random() * IMPACTS.length)];
      if (name)
        engine.play(
          name,
          0.25 + cue.strength * 0.5,
          0.85 + Math.random() * 0.3
        );
    });
    return () => {
      offCue();
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      engine.close();
      delete (window as unknown as { __audio?: unknown }).__audio;
      engineRef.current = null;
      state.beds = null;
    };
  }, [waterfalls]);

  const frame = useRef(0);
  useFrame(() => {
    const engine = engineRef.current;
    const s = st.current;
    const beds = s.beds;
    if (!engine || !beds) return;
    const rt = rtRef.current;
    const p = rt.player.pos;

    // The listener rides the camera.
    camera.getWorldDirection(tmp.fwd);
    tmp.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    engine.setListener(camera, tmp.fwd, tmp.up);

    // Footsteps by surface (walking only).
    const driving = rt.car.driving;
    const moved = Math.hypot(p.x - s.lastX, p.z - s.lastZ);
    s.lastX = p.x;
    s.lastZ = p.z;
    if (!driving && moved < 1 && rt.player.speed > 0.4) {
      s.stepAcc += moved;
      const stride = STRIDE * (rt.player.speed > 4 ? 1.25 : 1);
      if (s.stepAcc >= stride) {
        s.stepAcc = 0;
        const surf = surfaceAt(world.walk, p.x, p.z, p.y);
        const kind = footstepSurface(surf, world.walk, paved);
        const list = STEP_FILES[kind];
        const name = list[Math.floor(Math.random() * list.length)];
        if (name)
          engine.play(
            name,
            kind === "grass" ? 0.5 : 0.28,
            0.9 + Math.random() * 0.2
          );
      }
    } else if (driving || rt.player.speed <= 0.4) s.stepAcc = STRIDE * 0.6;

    // Engine pitch follows the speed.
    const car = rt.car.state;
    const speed =
      driving && car ? Math.min(1, Math.abs(car.speed) / CAR.maxSpeed) : 0;
    engine.setLevel(beds.engine, driving ? 0.12 + speed * 0.2 : 0, 0.15);
    if (driving) engine.setRate(beds.engine, 0.65 + speed * 1.15);

    // The ambient mix changes slowly: update it a few times a second.
    frame.current = (frame.current + 1) % 10;
    if (frame.current !== 0) return;
    if (rt.player.islandId) s.lastIsland = rt.player.islandId;
    const track = musicForIsland(s.lastIsland);
    const night = atmosphere.night;
    const rain = atmosphere.rain;
    beds.music[track] ??= engine.loop(`music-${track}`);
    for (const t of MUSIC_TRACKS) {
      const bed = beds.music[t];
      if (bed)
        engine.setLevel(bed, t === track ? 0.2 * (1 - night * 0.25) : 0, 1.6);
    }
    engine.setLevel(
      beds.birds,
      0.3 * atmosphere.daylight * (1 - rain * 0.8),
      2
    );
    engine.setLevel(
      beds.crickets,
      0.32 * Math.max(0, night - 0.35) * (1 - rain * 0.6),
      2
    );
    engine.setLevel(
      beds.wind,
      0.05 + atmosphere.gust * 0.22 + rain * 0.06,
      0.8
    );
    engine.setLevel(beds.rain, rain * 0.45, 1.5);
    engine.setWaterfallLevel(0.9 * (1 + rain * 0.6));
  });

  return null;
}
