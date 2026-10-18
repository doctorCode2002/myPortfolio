"use client";

import { Award, Flame, Gem, Sparkles, Stamp } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { dismissToast, type Toast } from "@/components/game3d/meta/store";
import { fmt, islandName } from "./strings";

const LIFE_MS = 4500;

function ToastItem({
  toast,
  dict,
}: {
  toast: Toast;
  dict: Dictionary;
}): ReactNode {
  const t = dict.play.meta;
  useEffect(() => {
    const id = setTimeout(() => dismissToast(toast.id), LIFE_MS);
    return () => clearTimeout(id);
  }, [toast.id]);

  let icon: ReactNode;
  let title: string;
  let body: string | null = null;
  switch (toast.kind) {
    case "achievement": {
      icon = <Award className="h-5 w-5 text-[#b0802a]" />;
      title = t.toastAchievement;
      const a = t.achievements[toast.achievement];
      body = `${a.name}: ${a.desc}`;
      break;
    }
    case "shard":
      icon = <Gem className="h-5 w-5 text-[#1b9fd1]" />;
      title = fmt(t.toastShard, { n: toast.found, total: toast.total });
      break;
    case "stamp":
      icon = <Stamp className="h-5 w-5 text-[#4f8f3a]" />;
      title = fmt(t.toastStamp, { island: islandName(dict, toast.islandId) });
      break;
    case "fire":
      icon = <Flame className="h-5 w-5 text-[#e2643b]" />;
      title = fmt(t.toastFire, { island: islandName(dict, toast.islandId) });
      break;
    case "unlock":
      icon = <Sparkles className="h-5 w-5 text-[#d4a52c]" />;
      title = toast.reward === "goldCar" ? t.toastGoldCar : t.toastGoldCloak;
      break;
  }
  return (
    <li className="meta-toast border-foreground/15 bg-background/95 text-foreground pointer-events-auto flex w-72 max-w-[80vw] items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm shadow-lg backdrop-blur-md">
      <span aria-hidden className="mt-0.5 shrink-0">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="font-semibold">{title}</span>
        {body ? (
          <span className="text-muted-foreground text-xs">{body}</span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="focus-ring text-muted-foreground hover:text-foreground cursor-pointer rounded px-1 text-xs"
      >
        {t.close}
      </button>
    </li>
  );
}

/** Unlock toasts (newest last), announced politely; they slide in unless motion is reduced. */
export function Toasts({
  toasts,
  dict,
  rtl,
}: {
  toasts: readonly Toast[];
  dict: Dictionary;
  rtl: boolean;
}): ReactNode {
  return (
    <>
      <ol
        aria-live="polite"
        aria-relevant="additions"
        dir={rtl ? "rtl" : "ltr"}
        className="pointer-events-none flex flex-col items-end gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} dict={dict} />
        ))}
      </ol>
      <style>{`
        .meta-toast { animation: meta-toast-in 320ms cubic-bezier(.2,.9,.3,1.2) both; }
        [dir="rtl"] > .meta-toast { animation-name: meta-toast-in-rtl; }
        @keyframes meta-toast-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
        @keyframes meta-toast-in-rtl { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .meta-toast { animation: none; } }
      `}</style>
    </>
  );
}
