"use client";

import { BookOpen, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { gameEvents } from "@/components/game/engine/events";
import { GUESTBOOK_STONE_ID } from "@/components/game3d/social/stone-layout";
import { submitGuestbook } from "@/lib/social/client";
import { GUESTBOOK } from "@/lib/social/config";
import type { SocialError } from "@/lib/social/errors";
import { socialLive } from "@/lib/social/live";
import {
  charCount,
  cleanText,
  type GuestbookLocale,
} from "@/lib/social/validate";

const FRAME =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, -2px -2px 0 0 #000, 2px -2px 0 0 #000, -2px 2px 0 0 #000, 2px 2px 0 0 #000, inset 0 0 0 2px #d4a359, inset 0 0 0 4px #261f18";
const BTN = "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000";
const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; error: SocialError };

/**
 * The guestbook writing panel, opened with E at the guestbook stone. Messages are sent
 * pending; the owner approves them in Supabase before they show on the notice board.
 */
export function GuestbookDialog({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: string;
}): ReactNode {
  const t = dict.play.social.guestbook;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [lang, setLang] = useState<GuestbookLocale>(
    locale === "ar" ? "ar" : "en"
  );
  const [island, setIsland] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const box = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const ids = useId();
  const rtl = locale === "ar";

  useEffect(
    () =>
      gameEvents.on("interact:building", ({ buildingId }) => {
        if (buildingId !== GUESTBOOK_STONE_ID) return;
        prevFocus.current = document.activeElement as HTMLElement | null;
        setIsland(socialLive.island ?? "home");
        setStatus((s) => (s.kind === "sent" ? { kind: "idle" } : s));
        setOpen(true);
      }),
    []
  );

  const close = useCallback(() => {
    setOpen(false);
    gameEvents.unlockUi("guestbook");
    prevFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!open) return;
    gameEvents.lockUi("guestbook");
    const timer = setTimeout(() => {
      box.current?.querySelector<HTMLElement>("input, textarea")?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const f = box.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!f || f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      gameEvents.unlockUi("guestbook");
    };
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  const nameLen = charCount(cleanText(name));
  const msgLen = charCount(cleanText(message));
  const nameOk = nameLen > 0 && nameLen <= GUESTBOOK.nameMax;
  const msgOk = msgLen > 0 && msgLen <= GUESTBOOK.messageMax;
  const sending = status.kind === "sending";

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (sending || !nameOk || !msgOk) {
      if (!nameOk || !msgOk) setStatus({ kind: "error", error: "invalid" });
      return;
    }
    setStatus({ kind: "sending" });
    void submitGuestbook({ name, message, locale: lang, island }).then(
      (res) => {
        if (res.ok) {
          setStatus({ kind: "sent" });
          setMessage("");
        } else setStatus({ kind: "error", error: res.error });
      }
    );
  };

  const counter = (n: number, max: number): string =>
    `text-[10px] font-mono ${n > max ? "text-red-600 dark:text-red-400 font-bold" : "text-muted-foreground"}`;

  const markup = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${ids}-title`}
      dir={rtl ? "rtl" : "ltr"}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm select-none sm:p-4"
      data-social-guestbook
    >
      <div
        ref={box}
        style={{ boxShadow: FRAME }}
        className="bg-background relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-y-auto p-4 select-text sm:p-5"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t.close}
          style={{ boxShadow: BTN }}
          className="focus-ring bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground absolute end-3 top-3 inline-flex h-7 w-7 cursor-pointer items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-3 flex items-center gap-2.5 pe-9">
          <BookOpen className="h-5 w-5 shrink-0 text-[#ab4c24]" aria-hidden />
          <h2
            id={`${ids}-title`}
            className="text-foreground text-base font-bold sm:text-lg"
          >
            {t.title}
          </h2>
        </div>
        <p className="text-muted-foreground mb-3 text-xs">{t.intro}</p>

        {status.kind === "sent" ? (
          <div className="flex flex-col gap-3" aria-live="polite">
            <p
              className="border-accent/40 bg-accent/10 text-foreground border p-3 text-sm"
              data-social-status="sent"
            >
              {t.sent}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus({ kind: "idle" })}
                style={{ boxShadow: BTN }}
                className="focus-ring bg-muted hover:bg-accent hover:text-accent-foreground cursor-pointer px-3 py-2 text-xs font-semibold"
              >
                {t.writeAnother}
              </button>
              <button
                type="button"
                onClick={close}
                style={{ boxShadow: BTN }}
                className="focus-ring bg-accent text-accent-foreground cursor-pointer px-3 py-2 text-xs font-bold"
              >
                {t.close}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor={`${ids}-name`}
                  className="text-xs font-semibold"
                >
                  {t.name}
                </label>
                <span className={counter(nameLen, GUESTBOOK.nameMax)} dir="ltr">
                  {nameLen}/{GUESTBOOK.nameMax}
                </span>
              </div>
              <input
                id={`${ids}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                autoComplete="nickname"
                dir="auto"
                maxLength={GUESTBOOK.nameMax + 20}
                className="focus-ring border-foreground/20 bg-muted/40 border px-2.5 py-2 text-sm"
                data-social-input="name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <label htmlFor={`${ids}-msg`} className="text-xs font-semibold">
                  {t.message}
                </label>
                <span
                  className={counter(msgLen, GUESTBOOK.messageMax)}
                  dir="ltr"
                >
                  {msgLen}/{GUESTBOOK.messageMax}
                </span>
              </div>
              <textarea
                id={`${ids}-msg`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.messagePlaceholder}
                rows={4}
                dir={lang === "ar" ? "rtl" : "ltr"}
                lang={lang}
                maxLength={GUESTBOOK.messageMax + 40}
                className="focus-ring border-foreground/20 bg-muted/40 resize-none border px-2.5 py-2 text-sm"
                data-social-input="message"
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <fieldset className="flex items-center gap-1.5">
                <legend className="sr-only">{t.language}</legend>
                <span className="text-xs font-semibold" aria-hidden>
                  {t.language}
                </span>
                {(["en", "ar"] as const).map((l) => (
                  <label
                    key={l}
                    className={`focus-within:ring-accent cursor-pointer border px-2 py-1 text-xs focus-within:ring-2 ${
                      lang === l
                        ? "border-accent bg-accent/15 font-semibold"
                        : "border-foreground/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${ids}-lang`}
                      value={l}
                      checked={lang === l}
                      onChange={() => setLang(l)}
                      className="sr-only"
                    />
                    {l === "en" ? t.langEn : t.langAr}
                  </label>
                ))}
              </fieldset>
              {island && (
                <span className="text-muted-foreground text-xs">
                  {t.island}:{" "}
                  <span className="text-foreground font-mono" dir="ltr">
                    {island}
                  </span>
                </span>
              )}
            </div>
            <p className="border-accent/30 bg-accent/10 text-foreground border p-2 text-xs">
              {t.note}
            </p>
            {status.kind === "error" && (
              <p
                role="alert"
                className="border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300"
                data-social-status={status.error}
              >
                {t.errors[status.error]}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={close}
                style={{ boxShadow: BTN }}
                className="focus-ring bg-muted hover:bg-accent hover:text-accent-foreground cursor-pointer px-3 py-2 text-xs font-semibold"
              >
                {t.close}
              </button>
              <button
                type="submit"
                disabled={sending}
                style={{ boxShadow: BTN }}
                className="focus-ring bg-accent text-accent-foreground cursor-pointer px-4 py-2 text-xs font-bold disabled:cursor-wait disabled:opacity-60"
                data-social-send
              >
                {sending ? t.sending : t.send}
              </button>
            </div>
            <p className="text-muted-foreground text-[10px] leading-snug">
              {t.privacy}
            </p>
          </form>
        )}
      </div>
    </div>
  );
  return createPortal(markup, document.body);
}
