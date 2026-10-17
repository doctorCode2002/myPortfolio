"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

import { AVAILABLE_CHARACTERS } from "../character-picker";
import { PreviewCharacter, PreviewLights } from "./preview-character";
import { usePickerModels, type PreviewModel } from "./use-picker-manifest";

/** Output: 64 CSS px at 2x, so 128x128 PNGs. */
const SIZE = 64;
const DPR = 2;

/** Grabs the canvas a few frames after the model is posed. */
function Capture({
  ready,
  onCapture,
}: {
  ready: boolean;
  onCapture: (dataUrl: string) => void;
}): null {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (!ready || done.current) return;
    frames.current += 1;
    if (frames.current < 4) return;
    done.current = true;
    onCapture(gl.domElement.toDataURL("image/png"));
  });
  return null;
}

function PortraitCanvas({
  charId,
  model,
  onCapture,
}: {
  charId: string;
  model: PreviewModel;
  onCapture: (charId: string, dataUrl: string) => void;
}): ReactNode {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  return (
    <Canvas
      style={{ width: SIZE, height: SIZE }}
      dpr={DPR}
      gl={{
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        toneMapping: THREE.NeutralToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      {/* Head and shoulders: the KayKit heads sit roughly 0.45-0.9 m up at the manifest scale. */}
      <PerspectiveCamera
        makeDefault
        fov={28}
        position={[0, 0.7, 1.15]}
        rotation={[-0.06, 0, 0]}
      />
      <PreviewLights />
      <PreviewCharacter
        charId={charId}
        model={model}
        still
        poseTime={0.35}
        onReady={markReady}
      />
      <Capture ready={ready} onCapture={(url) => onCapture(charId, url)} />
    </Canvas>
  );
}

/** Dev page body: one small canvas per character, then the PNGs as data URLs and downloads. */
export function PortraitStudio(): ReactNode {
  const { ready, models } = usePickerModels(AVAILABLE_CHARACTERS);
  const [shots, setShots] = useState<Record<string, string>>({});
  const onCapture = useCallback((charId: string, url: string) => {
    setShots((s) => (s[charId] ? s : { ...s, [charId]: url }));
  }, []);
  const allDone = AVAILABLE_CHARACTERS.every((id) => shots[id]);

  const downloadAll = (): void => {
    for (const id of AVAILABLE_CHARACTERS) {
      const url = shots[id];
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.png`;
      a.click();
    }
  };

  return (
    <div className="p-6 font-mono text-sm text-white/80">
      <h1 className="mb-1 text-base text-white">Character portraits (dev)</h1>
      <p className="mb-4 text-white/60">
        Saved to public/game3d/portraits/&lt;charId&gt;.png by{" "}
        <code>node scripts/3d/portraits.mjs</code>, or download them here.
      </p>
      {!ready ? (
        <p>Loading manifest…</p>
      ) : (
        <div className="flex flex-wrap gap-6">
          {AVAILABLE_CHARACTERS.map((id) => (
            <figure key={id} className="flex flex-col items-center gap-2">
              <div className="flex gap-2">
                <PortraitCanvas
                  charId={id}
                  model={models[id] ?? null}
                  onCapture={onCapture}
                />
                {shots[id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shots[id]}
                    alt={id}
                    width={SIZE}
                    height={SIZE}
                    className="rounded-full bg-gradient-to-b from-[#4a72a8] via-[#b9a7d0] to-[#f8b487]"
                  />
                )}
              </div>
              <figcaption>{id}</figcaption>
              <pre hidden data-portrait={id}>
                {shots[id] ?? ""}
              </pre>
            </figure>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={!allDone}
        onClick={downloadAll}
        data-portraits-done={allDone ? "yes" : "no"}
        className="mt-6 cursor-pointer rounded bg-white/10 px-3 py-2 text-white disabled:opacity-40"
      >
        Download all ({Object.keys(shots).length}/{AVAILABLE_CHARACTERS.length})
      </button>
    </div>
  );
}
