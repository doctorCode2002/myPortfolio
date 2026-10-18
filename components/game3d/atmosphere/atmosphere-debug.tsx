"use client";

import { useEffect, useState, type ReactNode } from "react";

import { atmosphere, setDebugHour } from "./store";
import { dominantPreset } from "./time-of-day";

/** Debug overlay rows (?debug=1): an hour slider, the live hour, rain and gusts. */
export function AtmosphereDebug(): ReactNode {
  const [snap, setSnap] = useState({
    hour: 18,
    rain: 0,
    gust: 0,
    forced: false,
  });
  useEffect(() => {
    const id = setInterval(
      () =>
        setSnap({
          hour: atmosphere.hour,
          rain: atmosphere.rain,
          gust: atmosphere.gust,
          forced: atmosphere.debugHour !== null,
        }),
      250
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-auto mt-1" data-game3d-atmo-debug>
      <div>
        time {snap.hour.toFixed(1)}h {dominantPreset(snap.hour)} rain{" "}
        {snap.rain.toFixed(2)} gust {snap.gust.toFixed(2)}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="range"
          min={0}
          max={24}
          step={0.1}
          value={snap.hour}
          aria-label="Hour of day"
          onChange={(e) => setDebugHour(Number(e.target.value))}
          className="w-36"
        />
        {snap.forced && (
          <button
            type="button"
            onClick={() => setDebugHour(null)}
            className="cursor-pointer rounded bg-white/15 px-1.5 hover:bg-white/30"
          >
            reset
          </button>
        )}
      </div>
    </div>
  );
}
