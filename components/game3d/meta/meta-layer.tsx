"use client";

import { useSyncExternalStore, type ReactNode } from "react";

import type { GameWorld } from "../logic/world-layout";
import { SignalFires, type FireLabels } from "./fires";
import { PhotoCamera } from "./photo-camera";
import { Shards } from "./shards";
import { getMetaSnapshot, getServerMetaSnapshot, subscribeMeta } from "./store";
import { MetaTracker } from "./tracker";

/**
 * The exploration meta inside the 3D scene: sky shards, signal fires, the progress
 * tracker (passport, fast travel, golden rewards) and photo mode's camera.
 */
export function MetaLayer({
  world,
  labels,
  touch,
  reducedMotion,
}: {
  world: GameWorld;
  labels: FireLabels;
  touch: boolean;
  reducedMotion: boolean;
}): ReactNode {
  const photo = useSyncExternalStore(
    subscribeMeta,
    () => getMetaSnapshot().ui.photo,
    () => getServerMetaSnapshot().ui.photo
  );
  return (
    <>
      <Shards world={world} reducedMotion={reducedMotion} />
      <SignalFires world={world} labels={labels} touch={touch} />
      <MetaTracker world={world} />
      {photo && <PhotoCamera />}
    </>
  );
}
