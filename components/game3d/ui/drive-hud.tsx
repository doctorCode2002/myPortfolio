"use client";

import { useSyncExternalStore, type ReactNode, type RefObject } from "react";

import { subscribeDriving, type Runtime } from "../runtime";

/** While driving: a small controls hint, and on touch screens an "Exit car" button. */
export function DriveHud({
  rtRef,
  hint,
  exitLabel,
  touch,
  rtl,
}: {
  rtRef: RefObject<Runtime>;
  hint: string;
  exitLabel: string;
  touch: boolean;
  rtl: boolean;
}): ReactNode {
  const driving = useSyncExternalStore(
    (cb) => subscribeDriving(rtRef.current, cb),
    () => rtRef.current.car.driving,
    () => false
  );
  if (!driving) return null;
  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      data-game3d-drive-hud
      className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex flex-col items-center gap-2 px-4"
    >
      {touch && (
        <button
          type="button"
          onClick={() => {
            rtRef.current.car.request = "exit";
          }}
          className="border-foreground/15 bg-background/90 text-foreground pointer-events-auto rounded-full border px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md"
          data-game3d-exit-car
        >
          {exitLabel}
        </button>
      )}
      <span className="bg-background/75 text-muted-foreground rounded-full px-3 py-1 text-center text-[11px] shadow backdrop-blur-sm sm:text-xs">
        {hint}
      </span>
    </div>
  );
}
