import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keep Tab inside `ref` while active, focus its first control (or `initial`) on open, and
 * give focus back to whatever had it before on close.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  initial?: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const before = document.activeElement as HTMLElement | null;
    const first =
      initial?.current ?? root.querySelector<HTMLElement>(FOCUSABLE) ?? root;
    first.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const a = items[0] as HTMLElement;
      const b = items[items.length - 1] as HTMLElement;
      if (
        e.shiftKey &&
        (document.activeElement === a || !root.contains(document.activeElement))
      ) {
        e.preventDefault();
        b.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === b || !root.contains(document.activeElement))
      ) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (before && document.contains(before)) before.focus();
    };
  }, [ref, active, initial]);
}
