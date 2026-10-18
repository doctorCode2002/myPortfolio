"use client";

import { Camera, Download } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { gameEvents } from "@/components/game/engine/events";
import {
  onPhotoFrame,
  PHOTO_LIMITS,
  photoOrbit,
} from "@/components/game3d/meta/photo-camera";
import {
  requestCapture,
  setPhoto,
  setPhotoCaption,
  setPhotoFilter,
  type PhotoFilter,
} from "@/components/game3d/meta/store";
import type { Runtime } from "@/components/game3d/runtime";
import { islandName } from "./strings";
import { useFocusTrap } from "./use-focus-trap";

export const SITE_CAPTION = "mohammedabutaleb.com";

/** Cheap CSS filters for the live canvas (the PNG gets the same through ctx.filter). */
export const PHOTO_FILTERS: Readonly<Record<PhotoFilter, string>> = {
  none: "none",
  warm: "sepia(0.28) saturate(1.25) hue-rotate(-8deg) brightness(1.03)",
  cool: "saturate(0.9) hue-rotate(14deg) brightness(1.04) contrast(1.04)",
  mono: "grayscale(1) contrast(1.12)",
};

const FILTER_IDS: readonly PhotoFilter[] = ["none", "warm", "cool", "mono"];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Draw the frame with its filter and (optionally) the caption band, then save a PNG. */
function savePhoto(
  frame: HTMLCanvasElement,
  filter: PhotoFilter,
  caption: string | null,
  fileStem: string
): void {
  const out = document.createElement("canvas");
  out.width = frame.width;
  out.height = frame.height;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  if ("filter" in ctx) ctx.filter = PHOTO_FILTERS[filter];
  ctx.drawImage(frame, 0, 0);
  if ("filter" in ctx) ctx.filter = "none";
  if (caption) {
    const w = out.width;
    const h = out.height;
    const m = Math.round(Math.min(w, h) * 0.025);
    const band = Math.round(Math.min(w, h) * 0.085);
    ctx.strokeStyle = "rgba(255, 250, 238, 0.95)";
    ctx.lineWidth = m;
    ctx.strokeRect(m / 2, m / 2, w - m, h - m);
    const grd = ctx.createLinearGradient(0, h - band * 1.8, 0, h);
    grd.addColorStop(0, "rgba(20, 16, 30, 0)");
    grd.addColorStop(1, "rgba(20, 16, 30, 0.55)");
    ctx.fillStyle = grd;
    ctx.fillRect(m, h - band * 1.8, w - 2 * m, band * 1.8 - m);
    ctx.fillStyle = "#fffaf0";
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 ${Math.round(band * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    ctx.fillText(SITE_CAPTION, m * 2.2, h - m * 2.2);
    ctx.textAlign = "right";
    ctx.font = `500 ${Math.round(band * 0.36)}px system-ui, sans-serif`;
    ctx.fillText(caption, w - m * 2.2, h - m * 2.2);
  }
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileStem}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}

/**
 * Photo mode: hides the HUD, frees the camera around the player (drag or arrow keys to
 * orbit, wheel / pinch / + - to zoom), offers filters and a caption frame, and downloads
 * the view as a PNG. Esc (or C) exits.
 */
export function PhotoOverlay({
  rtRef,
  dict,
  filter,
  caption,
  rtl,
}: {
  rtRef: RefObject<Runtime>;
  dict: Dictionary;
  filter: PhotoFilter;
  caption: boolean;
  rtl: boolean;
}): ReactNode {
  const t = dict.play.meta;
  const ref = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const [island, setIsland] = useState<string | null>(null);
  const settings = useRef({ filter, caption, island });
  useEffect(() => {
    settings.current = { filter, caption, island };
  }, [filter, caption, island]);
  useFocusTrap(ref, true, exitRef);

  // Freeze the game, hide the HUD and filter the live canvas while photo mode is on.
  useEffect(() => {
    gameEvents.lockUi("photo");
    return () => gameEvents.unlockUi("photo");
  }, []);
  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-engine="3d"] canvas'
    );
    if (!canvas) return;
    canvas.style.filter = PHOTO_FILTERS[filter];
    return () => {
      canvas.style.filter = "";
    };
  }, [filter]);

  // Captured frames come back here to be filtered, captioned and saved.
  useEffect(() => {
    onPhotoFrame((frame) => {
      const s = settings.current;
      const name = s.island ? islandName(dict, s.island) : null;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      savePhoto(
        frame,
        s.filter,
        s.caption ? (name ?? "") : null,
        `sky-islands-${s.island ?? "sky"}-${stamp}`
      );
    });
    return () => onPhotoFrame(null);
  }, [dict]);

  // The island under the player for the caption (it can't change while frozen, but a
  // travel fade may have just finished).
  useEffect(() => {
    const read = (): void => setIsland(rtRef.current.player.islandId);
    const first = setTimeout(read, 0);
    const id = setInterval(read, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [rtRef]);

  // Keyboard orbit and zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const turn = 0.12;
      switch (e.key) {
        case "ArrowLeft":
          photoOrbit.yaw -= turn;
          break;
        case "ArrowRight":
          photoOrbit.yaw += turn;
          break;
        case "ArrowUp":
          photoOrbit.pitch = clamp(
            photoOrbit.pitch + turn * 0.6,
            PHOTO_LIMITS.pitchMin,
            PHOTO_LIMITS.pitchMax
          );
          break;
        case "ArrowDown":
          photoOrbit.pitch = clamp(
            photoOrbit.pitch - turn * 0.6,
            PHOTO_LIMITS.pitchMin,
            PHOTO_LIMITS.pitchMax
          );
          break;
        case "+":
        case "=":
          photoOrbit.dist = clamp(
            photoOrbit.dist * 0.88,
            PHOTO_LIMITS.distMin,
            PHOTO_LIMITS.distMax
          );
          break;
        case "-":
        case "_":
          photoOrbit.dist = clamp(
            photoOrbit.dist * 1.14,
            PHOTO_LIMITS.distMin,
            PHOTO_LIMITS.distMax
          );
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pointer orbit (drag), wheel and pinch zoom on the full-screen surface.
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (e: PointerEvent): void => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      }
    };
    const move = (e: PointerEvent): void => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size === 1) {
        photoOrbit.yaw -= dx * 0.006;
        photoOrbit.pitch = clamp(
          photoOrbit.pitch + dy * 0.005,
          PHOTO_LIMITS.pitchMin,
          PHOTO_LIMITS.pitchMax
        );
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        if (!a || !b) return;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0)
          photoOrbit.dist = clamp(
            photoOrbit.dist * (pinch / d),
            PHOTO_LIMITS.distMin,
            PHOTO_LIMITS.distMax
          );
        pinch = d;
      }
    };
    const up = (e: PointerEvent): void => {
      pts.delete(e.pointerId);
      pinch = 0;
    };
    const wheel = (e: WheelEvent): void => {
      e.preventDefault();
      photoOrbit.dist = clamp(
        photoOrbit.dist * Math.exp(e.deltaY * 0.0015),
        PHOTO_LIMITS.distMin,
        PHOTO_LIMITS.distMax
      );
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  const name = island ? islandName(dict, island) : "";
  const pill =
    "focus-ring border-foreground/15 bg-background/85 text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md sm:text-sm";

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={t.photoTitle}
      data-photo-ui
      dir={rtl ? "rtl" : "ltr"}
      className="absolute inset-0 z-[55]"
    >
      <div
        ref={surface}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      />
      {caption && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 border-[10px] border-[#fffaee]/90 sm:border-[14px]"
        >
          <div
            className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/50 to-transparent px-4 pt-10 pb-3 text-[#fffaf0]"
            dir="ltr"
          >
            <span className="text-sm font-semibold sm:text-base">
              {SITE_CAPTION}
            </span>
            <span className="text-xs sm:text-sm">{name}</span>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center justify-center gap-2 p-3 sm:p-5">
        <span className={`${pill} pointer-events-auto cursor-default`}>
          <Camera aria-hidden className="h-4 w-4" />
          {t.photoTitle}
        </span>
        <div
          role="radiogroup"
          aria-label={t.photoFilter}
          className="border-foreground/15 bg-background/85 pointer-events-auto flex items-center gap-0.5 rounded-full border p-0.5 shadow-sm backdrop-blur-md"
        >
          {FILTER_IDS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setPhotoFilter(f)}
              className={`focus-ring cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium sm:text-sm ${filter === f ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"}`}
            >
              {t.filters[f]}
            </button>
          ))}
        </div>
        <label className={`${pill} pointer-events-auto`}>
          <input
            type="checkbox"
            className="accent-accent h-4 w-4"
            checked={caption}
            onChange={(e) => setPhotoCaption(e.target.checked)}
          />
          {t.photoCaption}
        </label>
        <button
          type="button"
          onClick={requestCapture}
          className={`${pill} pointer-events-auto`}
          data-photo-download
        >
          <Download aria-hidden className="h-4 w-4" />
          {t.photoDownload}
        </button>
        <button
          ref={exitRef}
          type="button"
          onClick={() => setPhoto(false)}
          className={`${pill} pointer-events-auto`}
        >
          {t.photoExit}
        </button>
      </div>
      <p className="text-foreground/90 bg-background/70 pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-center text-[11px] backdrop-blur-sm sm:text-xs">
        {t.photoHelp}
      </p>
      {/* Hide every other overlay (HUD, prompts, labels) while composing a photo. */}
      <style>{`
        [data-engine="3d"] canvas ~ div,
        [data-engine="3d"] > :first-child > :not(:first-child),
        [data-engine="3d"] > :not(:first-child):not([data-meta-hud]) { display: none !important; }
      `}</style>
    </div>
  );
}
