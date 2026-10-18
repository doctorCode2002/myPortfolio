"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fetchGuestbook, type GuestbookMessage } from "@/lib/social/client";
import { relativeTime } from "@/lib/social/time";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; messages: GuestbookMessage[] };

const CARD =
  "0 -1px 0 0 #000, 0 1px 0 0 #000, -1px 0 0 0 #000, 1px 0 0 0 #000, inset 0 0 0 1px rgba(255,255,255,0.08)";

/** The latest approved guestbook messages (each in its own language direction). */
export function GuestbookList({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: string;
}): ReactNode {
  const t = dict.play.social.guestbook;
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [now, setNow] = useState(0);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void fetchGuestbook().then((res) => {
      if (!live) return;
      setNow(Date.now());
      setState(
        res.ok ? { kind: "ready", messages: res.messages } : { kind: "error" }
      );
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = (): void => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  if (state.kind === "loading")
    return (
      <p
        className="text-muted-foreground py-4 text-center text-xs"
        aria-live="polite"
      >
        {t.loading}
      </p>
    );
  if (state.kind === "error")
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-muted-foreground text-xs">{t.loadError}</p>
        <button
          type="button"
          onClick={retry}
          className="focus-ring bg-muted hover:bg-accent hover:text-accent-foreground cursor-pointer px-3 py-1.5 text-xs font-semibold"
        >
          {t.retry}
        </button>
      </div>
    );
  if (state.messages.length === 0)
    return (
      <p className="text-muted-foreground py-4 text-center text-xs">
        {t.empty}
      </p>
    );
  return (
    <ul className="space-y-2" data-social-guestbook-list>
      {state.messages.map((m) => (
        <li
          key={m.id}
          lang={m.locale}
          dir={m.locale === "ar" ? "rtl" : "ltr"}
          style={{ boxShadow: CARD }}
          className="bg-muted/40 p-2.5 text-start sm:p-3"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-foreground truncate text-xs font-bold sm:text-sm">
              {m.name}
            </span>
            <time
              dateTime={m.created_at}
              dir="auto"
              className="text-muted-foreground shrink-0 font-mono text-[10px] sm:text-[11px]"
            >
              {relativeTime(m.created_at, now, locale)}
            </time>
          </div>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed break-words whitespace-pre-line">
            {m.message}
          </p>
        </li>
      ))}
    </ul>
  );
}
