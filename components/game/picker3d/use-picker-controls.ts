"use client";

import { useEffect, useRef, type RefObject } from "react";

import { gameEvents } from "../engine/events";

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Index reached from `cur` by an arrow key in a grid of `cols` columns (RTL mirrors left/right). */
export function gridStep(
  key: string,
  cur: number,
  count: number,
  cols: number,
  rtl: boolean
): number | null {
  const right = rtl ? "ArrowLeft" : "ArrowRight";
  const left = rtl ? "ArrowRight" : "ArrowLeft";
  if (key === right) return (cur + 1) % count;
  if (key === left) return (cur - 1 + count) % count;
  if (key === "ArrowDown") return (cur + cols) % count;
  if (key === "ArrowUp") return (cur - cols + count) % count;
  return null;
}

/**
 * The picker's shared behaviour: the "picker" ui lock while open, arrow keys over the grid,
 * Enter/Space to confirm, Escape to close, and a focus trap that restores focus on close.
 */
export function usePickerControls<T extends string>({
  isOpen,
  ids,
  highlighted,
  setHighlighted,
  columns,
  rtl,
  dialogRef,
  onConfirm,
  onClose,
  focusCard,
}: {
  isOpen: boolean;
  ids: readonly T[];
  highlighted: T;
  setHighlighted: (id: T) => void;
  columns: number;
  rtl: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onClose?: (() => void) | undefined;
  /** Move DOM focus to a card when the arrow keys move the highlight. */
  focusCard?: ((id: T) => void) | undefined;
}): void {
  const previousFocus = useRef<HTMLElement | null>(null);

  // Lock the game UI while open.
  useEffect(() => {
    if (!isOpen) return;
    gameEvents.lockUi("picker");
    return () => {
      gameEvents.unlockUi("picker");
    };
  }, [isOpen]);

  // Focus into the dialog on open, back to the opener on close.
  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(
        '[data-char-card][aria-checked="true"]'
      );
      el?.focus();
    }, 20);
    return () => {
      clearTimeout(t);
      previousFocus.current?.focus?.();
    };
    // Only on open/close; the highlighted card is read once.
  }, [isOpen, dialogRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Tab") {
        const focusables = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
        ).filter((el) => el.tabIndex >= 0);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const inside = dialogRef.current?.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === first || !inside)) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || !inside)
        ) {
          e.preventDefault();
          first?.focus();
        }
        return;
      }

      const curIdx = ids.indexOf(highlighted);
      if (curIdx === -1) return;
      const nextIdx = gridStep(e.key, curIdx, ids.length, columns, rtl);
      if (nextIdx !== null) {
        e.preventDefault();
        const next = ids[nextIdx] ?? ids[0];
        if (next !== undefined) {
          setHighlighted(next);
          focusCard?.(next);
        }
        return;
      }

      // Enter/Space on another control (the close button) keeps its own meaning.
      const target = e.target as HTMLElement | null;
      const onOtherControl =
        target?.closest("button") && !target.closest("[data-char-card]");
      if ((e.key === "Enter" || e.key === " ") && !onOtherControl) {
        e.preventDefault();
        gameEvents.unlockUi("picker");
        onConfirm();
      } else if (e.key === "Escape" && onClose) {
        e.preventDefault();
        gameEvents.unlockUi("picker");
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    ids,
    highlighted,
    setHighlighted,
    columns,
    rtl,
    dialogRef,
    onConfirm,
    onClose,
    focusCard,
  ]);
}
