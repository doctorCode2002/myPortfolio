"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

import { isMotionAllowed, onMotionChange } from "@/lib/motion";

/**
 * SwarmRebuild — a section-scoped take on the "Swarm Rebuild" idea: a lead
 * cursor marquee-selects the section and deletes it, then a team of named
 * multiplayer cursors rebuilds it piece by piece, the way people build a frame
 * together in a design tool:
 *
 *   box    → crosshair drag with a selection frame, handles and a W × H pill
 *   text   → I-beam that types each line out (clip-path staircase)
 *   media  → image placeholder (crossed frame), then the real pixels wipe in
 *   pen    → pen tool tracing the strokes of an <svg data-swarm="pen">
 *   repeat → alt-drag duplicate when a sibling with the same class is built
 *
 * When the build is done the crew stays and swirls around the visitor's
 * pointer (follow mode) until the next rebuild; pass follow={false} to have
 * the cursors fly out instead.
 *
 * The real DOM is never replaced: every piece is hidden with an inline
 * `visibility: hidden` (which a descendant can override, so parents and
 * children reveal independently) and restored exactly afterwards. Content is
 * fully visible before the effect runs and after it ends, so SSR, SEO and
 * reduced-motion users see a normal page.
 *
 * Markup hooks:
 *   data-swarm="box|text|media|pen"  force how an element is built
 *   data-swarm="ignore"              not a piece itself, but walk its children
 *   data-swarm-skip                  leave this subtree completely alone
 *
 * Original implementation; written for this site, not derived from the
 * extension's source.
 */

type Kind = "box" | "text" | "media" | "pen";

type Line = { top: number; bottom: number; left: number; right: number };

type Piece = {
  el: HTMLElement | SVGElement;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  parent: Piece | null;
  dupOf: Piece | null;
  taken: boolean;
  done: boolean;
  prev: { visibility: string; clipPath: string; opacity: string };
};

type CursorShape = "arrow" | "cross" | "ibeam" | "pen" | "dup";

type Agent = {
  el: HTMLDivElement;
  icon: HTMLDivElement;
  color: string;
  x: number;
  y: number;
};

export type SwarmRebuildProps = {
  children: ReactNode;
  className?: string;
  /** Builders besides the lead (default 9). */
  agents?: number;
  /** Cursor colours, cycled. */
  colors?: readonly string[];
  /** Cursor name tags, cycled. */
  names?: readonly string[];
  /** Marquee / selection frame colour. */
  selection?: string;
  /** Ruler guide colour. */
  guide?: string;
  /** Extra classes for the name tags and the W × H pill (font, radius). */
  labelClassName?: string;
  /** Global speed multiplier (default 1). */
  speed?: number;
  /** Start when scrolled into view, or only via the replay button. */
  autoplay?: "inView" | "manual";
  /** Show a replay button; pass a node to customise its label. */
  replay?: boolean | ReactNode;
  replayClassName?: string;
  /**
   * After the rebuild, keep the crew and let it swirl around the visitor's
   * pointer (wandering on its own when the pointer is outside the section).
   * Default true; false flies the cursors out instead.
   */
  follow?: boolean;
  /** Crew size in follow mode; extra cursors stream in up to this (default 16). */
  followAgents?: number;
  onComplete?: () => void;
};

const DEFAULT_COLORS = [
  "#F24E1E",
  "#A259FF",
  "#1ABCFE",
  "#0ACF83",
  "#FF7262",
  "#FFC700",
  "#E8467C",
  "#0D99FF",
  "#FF8A00",
  "#14AE5C",
];

const DEFAULT_NAMES = [
  "Lina",
  "Omar",
  "Sara",
  "Yousef",
  "Noor",
  "Kareem",
  "Hana",
  "Ziad",
  "Maya",
  "Adam",
  "Rana",
  "Tariq",
  "Leen",
  "Sami",
];

const ABORT = Symbol("swarm-abort");

const clamp = (v: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, v));
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

// ------------------------------------------------------------- cursor art

const HOTSPOT: Record<CursorShape, [number, number]> = {
  arrow: [4, 3],
  dup: [4, 3],
  cross: [12, 12],
  ibeam: [12, 12],
  pen: [4, 4],
};

function cursorSvg(shape: CursorShape, c: string): string {
  const edge = 'stroke="#fff" stroke-width="1.6" stroke-linejoin="round"';
  const arrow = `<path d="M4 3 L4 19.5 L8.6 15.4 L11.7 21.6 L14.4 20.3 L11.4 14.2 L17.6 14.2 Z" fill="${c}" ${edge}/>`;
  let body: string;
  switch (shape) {
    case "arrow":
      body = arrow;
      break;
    case "dup":
      body =
        `<g transform="translate(5 4)" opacity=".9"><path d="M4 3 L4 19.5 L8.6 15.4 L11.7 21.6 L14.4 20.3 L11.4 14.2 L17.6 14.2 Z" fill="#fff" stroke="${c}" stroke-width="1.4" stroke-linejoin="round"/></g>` +
        arrow;
      break;
    case "cross":
      body =
        `<path d="M12 3v18M3 12h18" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>` +
        `<path d="M12 3v18M3 12h18" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
      break;
    case "ibeam":
      body =
        `<path d="M9 4.5h6M9 19.5h6M12 4.5v15" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>` +
        `<path d="M9 4.5h6M9 19.5h6M12 4.5v15" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
      break;
    case "pen":
      body =
        `<path d="M4 4 L14.5 7.5 L19 12 L12 19 L7.5 14.5 Z" fill="${c}" ${edge}/>` +
        `<path d="M4.6 4.6 L9.6 9.6" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>` +
        `<circle cx="10.6" cy="10.6" r="1.6" fill="none" stroke="#fff" stroke-width="1.2"/>`;
      break;
  }
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

// ------------------------------------------------------------- DOM probes

function alphaOf(color: string): number {
  if (!color || color === "transparent") return 0;
  const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)/);
  if (slash) return parseFloat(slash[1]!) / (slash[2] ? 100 : 1);
  const rgba = color.match(/^rgba\(([^)]+)\)/);
  if (rgba) {
    const parts = rgba[1]!.split(",");
    return parts.length >= 4 ? parseFloat(parts[3]!) : 1;
  }
  return 1;
}

function hasDirectText(el: Element): boolean {
  for (const node of el.childNodes) {
    if (
      node.nodeType === Node.TEXT_NODE &&
      (node.textContent ?? "").trim().length > 0
    )
      return true;
  }
  return false;
}

function hasVisualBox(cs: CSSStyleDeclaration): boolean {
  if (alphaOf(cs.backgroundColor) > 0.04) return true;
  if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
  if (cs.boxShadow && cs.boxShadow !== "none") return true;
  const bw =
    parseFloat(cs.borderTopWidth) +
    parseFloat(cs.borderRightWidth) +
    parseFloat(cs.borderBottomWidth) +
    parseFloat(cs.borderLeftWidth);
  return (
    bw > 0 && alphaOf(cs.borderTopColor) > 0.04 && cs.borderTopStyle !== "none"
  );
}

const MEDIA_TAGS = new Set([
  "img",
  "video",
  "canvas",
  "picture",
  "iframe",
  "svg",
]);
const FORCED = new Set(["box", "text", "media", "pen"]);

function collectPieces(root: HTMLElement, content: HTMLElement): Piece[] {
  const origin = root.getBoundingClientRect();
  const pieces: Piece[] = [];

  const walk = (
    el: Element,
    parent: Piece | null,
    insideText: boolean
  ): void => {
    if (el.hasAttribute("data-swarm-skip")) return;
    const cs = getComputedStyle(el);
    if (
      cs.display === "none" ||
      cs.visibility === "hidden" ||
      parseFloat(cs.opacity) === 0
    )
      return;

    const tag = el.tagName.toLowerCase();
    const forced = el.getAttribute("data-swarm");
    let kind: Kind | null = null;

    if (forced === "ignore") kind = null;
    else if (forced && FORCED.has(forced)) kind = forced as Kind;
    else if (insideText) kind = null;
    else if (MEDIA_TAGS.has(tag)) kind = "media";
    else if (hasDirectText(el)) kind = "text";
    else if (hasVisualBox(cs)) kind = "box";

    const r = el.getBoundingClientRect();
    if (kind && (r.width < 4 || r.height < 4)) kind = null;

    let here = parent;
    if (kind) {
      const style = (el as HTMLElement | SVGElement).style;
      here = {
        el: el as HTMLElement | SVGElement,
        kind,
        x: r.left - origin.left,
        y: r.top - origin.top,
        w: r.width,
        h: r.height,
        parent,
        dupOf: null,
        taken: false,
        done: false,
        prev: {
          visibility: style.visibility,
          clipPath: style.clipPath,
          opacity: style.opacity,
        },
      };
      pieces.push(here);
    }

    if (kind === "media" || kind === "pen") return;
    for (const child of el.children)
      walk(child, here, insideText || kind === "text");
  };

  for (const child of content.children) walk(child, null, false);

  // Repeated components: a box whose previous sibling-piece shares its class
  // list and size gets built as an alt-drag duplicate of it.
  for (const p of pieces) {
    if (p.kind !== "box") continue;
    const prev = p.el.previousElementSibling;
    if (!prev) continue;
    const twin = pieces.find((q) => q.el === prev);
    if (
      twin &&
      twin.kind === "box" &&
      (twin.el.getAttribute("class") ?? "") ===
        (p.el.getAttribute("class") ?? "") &&
      Math.abs(twin.w - p.w) < 8 &&
      Math.abs(twin.h - p.h) < 40
    ) {
      p.dupOf = twin;
    }
  }

  return pieces;
}

/** Line boxes of an element's text, relative to the element's border box. */
function textLines(el: Element): Line[] {
  const box = el.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  const lines: Line[] = [];
  for (const r of range.getClientRects()) {
    if (r.width < 1 || r.height < 1) continue;
    const top = r.top - box.top;
    const bottom = r.bottom - box.top;
    const left = r.left - box.left;
    const right = r.right - box.left;
    const same = lines.find(
      (l) =>
        Math.abs(l.top - top) < 4 || (top < l.bottom - 2 && bottom > l.top + 2)
    );
    if (same) {
      same.top = Math.min(same.top, top);
      same.bottom = Math.max(same.bottom, bottom);
      same.left = Math.min(same.left, left);
      same.right = Math.max(same.right, right);
    } else {
      lines.push({ top, bottom, left, right });
    }
  }
  range.detach();
  lines.sort((a, b) => a.top - b.top);
  return lines.length
    ? lines
    : [{ top: 0, bottom: box.height, left: 0, right: box.width }];
}

// ------------------------------------------------------------- component

export function SwarmRebuild({
  children,
  className,
  agents = 9,
  colors = DEFAULT_COLORS,
  names = DEFAULT_NAMES,
  selection = "#0D99FF",
  guide = "#F24822",
  labelClassName = "",
  speed = 1,
  autoplay = "inView",
  replay = true,
  replayClassName,
  follow = true,
  followAgents = 16,
  onComplete,
}: SwarmRebuildProps): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<{ abort: () => void } | null>(null);
  const optsRef = useRef({
    agents,
    colors,
    names,
    selection,
    guide,
    labelClassName,
    speed,
    follow,
    followAgents,
    onComplete,
  });
  useEffect(() => {
    optsRef.current = {
      agents,
      colors,
      names,
      selection,
      guide,
      labelClassName,
      speed,
      follow,
      followAgents,
      onComplete,
    };
  });

  const run = useCallback(async () => {
    const root = rootRef.current;
    const content = contentRef.current;
    const overlay = overlayRef.current;
    if (!root || !content || !overlay) return;

    runRef.current?.abort();

    const o = optsRef.current;
    let aborted = false;
    const live = new Set<Animation>();
    const pieces = collectPieces(root, content);
    if (pieces.length === 0) return;

    let stopFollow: (() => void) | null = null;

    const restorePieces = (): void => {
      for (const a of live) a.cancel();
      live.clear();
      for (const p of pieces) {
        const s = p.el.style;
        s.visibility = p.prev.visibility;
        s.clipPath = p.prev.clipPath;
        s.opacity = p.prev.opacity;
        if (p.kind === "pen") {
          p.el
            .querySelectorAll<SVGGeometryElement>(
              "path, line, polyline, circle, rect"
            )
            .forEach((g) => {
              g.style.strokeDasharray = "";
              g.style.strokeDashoffset = "";
            });
        }
      }
    };

    const restore = (): void => {
      stopFollow?.();
      stopFollow = null;
      restorePieces();
      overlay.replaceChildren();
    };

    const handle = {
      abort: () => {
        aborted = true;
        restore();
      },
    };
    runRef.current = handle;

    const guard = (): void => {
      if (aborted) throw ABORT;
    };
    const track = async (a: Animation): Promise<void> => {
      live.add(a);
      try {
        await a.finished;
      } catch {
        /* cancelled */
      }
      live.delete(a);
      guard();
    };
    const sleep = async (ms: number): Promise<void> => {
      await new Promise((r) => setTimeout(r, ms / o.speed));
      guard();
    };
    const tween = async (
      ms: number,
      step: (t: number) => void
    ): Promise<void> => {
      const dur = ms / o.speed;
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number): void => {
          if (aborted) return resolve();
          const t = clamp((now - start) / dur, 0, 1);
          step(t);
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      guard();
    };

    const W = root.clientWidth;
    const H = root.clientHeight;
    // Dense sections build each piece faster so the whole run stays ~8–12 s.
    const density = clamp(70 / pieces.length, 0.4, 1);

    // ---------------------------------------------------------- primitives

    const el = (css: string, html = ""): HTMLDivElement => {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;left:0;top:0;${css}`;
      d.innerHTML = html;
      overlay.appendChild(d);
      return d;
    };

    const label = (text: string, bg: string): string =>
      `<span class="${o.labelClassName}" style="position:absolute;left:18px;top:20px;white-space:nowrap;background:${bg};color:#fff;font-size:11px;line-height:1;font-weight:500;padding:4px 6px;border-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.2)">${text}</span>`;

    let agentCount = 0;
    const spawn = (x: number, y: number, name?: string): Agent => {
      const i = agentCount++;
      const color = o.colors[i % o.colors.length]!;
      const tag = name ?? o.names[i % o.names.length]!;
      const wrap = el(
        `z-index:3;will-change:transform;transform:translate3d(${x}px,${y}px,0)`,
        `<div data-icon style="position:absolute"></div>${label(tag, color)}`
      );
      const agent: Agent = {
        el: wrap,
        icon: wrap.querySelector("[data-icon]")!,
        color,
        x,
        y,
      };
      shape(agent, "arrow");
      return agent;
    };

    const shape = (a: Agent, s: CursorShape): void => {
      const [hx, hy] = HOTSPOT[s];
      a.icon.style.transformOrigin = `${hx}px ${hy}px`;
      a.icon.style.transform = `translate(${-hx}px,${-hy}px)`;
      a.icon.innerHTML = cursorSvg(s, a.color);
    };

    const place = (a: Agent, x: number, y: number): void => {
      a.x = x;
      a.y = y;
      a.el.style.transform = `translate3d(${x}px,${y}px,0)`;
    };

    const move = async (
      a: Agent,
      x: number,
      y: number,
      ms?: number
    ): Promise<void> => {
      const d = Math.hypot(x - a.x, y - a.y);
      const dur = (ms ?? clamp(d * 0.75, 160, 850)) * (0.6 + 0.4 * density);
      const from = `translate3d(${a.x}px,${a.y}px,0)`;
      const to = `translate3d(${x}px,${y}px,0)`;
      const anim = a.el.animate([{ transform: from }, { transform: to }], {
        duration: dur / o.speed,
        easing: "cubic-bezier(.5,0,.2,1)",
        fill: "forwards",
      });
      a.x = x;
      a.y = y;
      await track(anim);
      a.el.style.transform = to;
      anim.cancel();
    };

    const hide = (p: Piece): void => {
      p.el.style.visibility = "hidden";
    };
    const show = (p: Piece): void => {
      p.el.style.visibility = "visible";
    };
    const fadeIn = (target: Element, ms = 260): void => {
      const a = target.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ms / o.speed,
        easing: "ease-out",
      });
      live.add(a);
      a.finished.then(() => live.delete(a)).catch(() => live.delete(a));
    };
    const fadeOutRemove = (d: HTMLElement, ms = 260): void => {
      const a = d.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: ms / o.speed,
        fill: "forwards",
      });
      a.finished.then(() => d.remove()).catch(() => d.remove());
    };

    const frame = (
      x: number,
      y: number,
      fill = "transparent"
    ): HTMLDivElement => {
      const handle = (pos: string): string =>
        `<i style="position:absolute;${pos};width:7px;height:7px;background:#fff;border:1px solid ${o.selection}"></i>`;
      return el(
        `z-index:2;transform:translate(${x}px,${y}px);width:0;height:0;border:1px solid ${o.selection};background:${fill}`,
        handle("left:-4px;top:-4px") +
          handle("right:-4px;top:-4px") +
          handle("left:-4px;bottom:-4px") +
          handle("right:-4px;bottom:-4px") +
          `<span class="${o.labelClassName}" data-dim style="position:absolute;left:50%;top:calc(100% + 7px);transform:translateX(-50%);white-space:nowrap;background:${o.selection};color:#fff;font-size:10px;line-height:1;padding:3px 5px;border-radius:3px;font-variant-numeric:tabular-nums"></span>`
      );
    };

    const guideLine = (p: Piece): HTMLDivElement | null => {
      if (Math.random() > 0.4) return null;
      const horizontal = Math.random() > 0.45;
      const pos = horizontal ? p.y : p.x;
      const g = el(
        horizontal
          ? `z-index:1;top:${pos}px;width:${W}px;height:0;border-top:1px solid ${o.guide}`
          : `z-index:1;left:${pos}px;height:${H}px;width:0;border-left:1px solid ${o.guide}`,
        `<span class="${o.labelClassName}" style="position:absolute;${horizontal ? "left:6px;top:-16px" : "top:6px;left:4px"};font-size:9px;color:${o.guide}">${Math.round(pos)}</span>`
      );
      fadeIn(g, 160);
      return g;
    };

    // ---------------------------------------------------------- builders

    const buildBox = async (
      a: Agent,
      p: Piece,
      media: boolean
    ): Promise<void> => {
      shape(a, "cross");
      await move(a, p.x, p.y);
      const g = guideLine(p);
      const f = frame(p.x, p.y, media ? `${o.selection}14` : "transparent");
      const dim = f.querySelector<HTMLSpanElement>("[data-dim]")!;
      if (media) {
        f.insertAdjacentHTML(
          "afterbegin",
          `<svg style="position:absolute;inset:0;width:100%;height:100%" preserveAspectRatio="none" viewBox="0 0 100 100"><path d="M0 0L100 100M100 0L0 100" stroke="${o.selection}" stroke-opacity=".45" stroke-width=".6" vector-effect="non-scaling-stroke"/></svg>`
        );
      }
      const dur = clamp(Math.hypot(p.w, p.h) * 1.1, 260, 900) * density;
      await tween(dur, (t) => {
        const e = easeInOut(t);
        const w = p.w * e;
        const h = p.h * e;
        f.style.width = `${w}px`;
        f.style.height = `${h}px`;
        dim.textContent = `${Math.round(w)} × ${Math.round(h)}`;
        place(a, p.x + w, p.y + h);
      });
      if (media) {
        await sleep(160 * density);
        show(p);
        const wipe = p.el.animate(
          [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }],
          { duration: 480 / o.speed, easing: "cubic-bezier(.6,0,.2,1)" }
        );
        live.add(wipe);
        wipe.finished
          .then(() => live.delete(wipe))
          .catch(() => live.delete(wipe));
      } else {
        show(p);
        fadeIn(p.el);
      }
      fadeOutRemove(f, 320);
      if (g) fadeOutRemove(g, 420);
    };

    const buildDup = async (a: Agent, p: Piece, src: Piece): Promise<void> => {
      shape(a, "arrow");
      await move(a, src.x + src.w * 0.5, src.y + src.h * 0.5);
      shape(a, "dup");
      const ghost = el(
        `z-index:2;transform:translate(${src.x}px,${src.y}px);width:${src.w}px;height:${src.h}px;border:1px dashed ${o.selection};background:${o.selection}10`
      );
      await tween(560 * density, (t) => {
        const e = easeInOut(t);
        const x = src.x + (p.x - src.x) * e;
        const y = src.y + (p.y - src.y) * e;
        ghost.style.transform = `translate(${x}px,${y}px)`;
        ghost.style.width = `${src.w + (p.w - src.w) * e}px`;
        ghost.style.height = `${src.h + (p.h - src.h) * e}px`;
        place(a, x + p.w * 0.5, y + p.h * 0.5);
      });
      show(p);
      fadeIn(p.el, 200);
      fadeOutRemove(ghost, 220);
    };

    const buildText = async (a: Agent, p: Piece): Promise<void> => {
      const lines = textLines(p.el);
      const first = lines[0]!;
      // Right-to-left text (Arabic) types in from the right edge of each line.
      const rtl = getComputedStyle(p.el).direction === "rtl";
      shape(a, "ibeam");
      await move(
        a,
        p.x + (rtl ? first.right : first.left),
        p.y + (first.top + first.bottom) / 2
      );
      const s = p.el.style;
      s.clipPath = "polygon(0 0,0 0,0 0)";
      show(p);
      const widths = lines.map((l) => Math.max(1, l.right - l.left));
      const total = widths.reduce((x, y) => x + y, 0);
      const chars = (p.el.textContent ?? "").length;
      const dur = clamp(chars * 16, 240, 1700) * density;
      const W2 = p.w + 2;
      await tween(dur, (t) => {
        let budget = t * total;
        let i = 0;
        while (i < lines.length - 1 && budget > widths[i]!) {
          budget -= widths[i]!;
          i++;
        }
        const l = lines[i]!;
        const typed = Math.min(budget, widths[i]!);
        const top = l.top;
        const bottom = l.bottom + 2;
        let xCur: number;
        if (rtl) {
          // Lines above fully shown; current line revealed from its right edge.
          xCur = l.right - typed;
          s.clipPath = `polygon(-2px -2px, ${W2}px -2px, ${W2}px ${bottom}px, ${xCur}px ${bottom}px, ${xCur}px ${top}px, -2px ${top}px)`;
        } else {
          xCur = l.left + typed;
          s.clipPath = `polygon(-2px -2px, ${W2}px -2px, ${W2}px ${top}px, ${xCur}px ${top}px, ${xCur}px ${bottom}px, -2px ${bottom}px)`;
        }
        place(a, p.x + xCur, p.y + (l.top + l.bottom) / 2);
      });
      s.clipPath = p.prev.clipPath;
    };

    const buildPen = async (a: Agent, p: Piece): Promise<void> => {
      const geos = Array.from(
        p.el.querySelectorAll<SVGGeometryElement>(
          "path, line, polyline, circle, rect"
        )
      ).filter((g) => typeof g.getTotalLength === "function");
      shape(a, "pen");
      const lens = geos.map((g) => {
        const len = g.getTotalLength();
        g.style.strokeDasharray = `${len}`;
        g.style.strokeDashoffset = `${len}`;
        return len;
      });
      show(p);
      const origin = root.getBoundingClientRect();
      for (let i = 0; i < geos.length; i++) {
        const g = geos[i]!;
        const len = lens[i]!;
        const ctm = g.getScreenCTM();
        const at = (l: number): [number, number] => {
          const pt = g.getPointAtLength(l);
          if (!ctm) return [p.x, p.y];
          const q = new DOMPoint(pt.x, pt.y).matrixTransform(ctm);
          return [q.x - origin.left, q.y - origin.top];
        };
        const [sx, sy] = at(0);
        await move(a, sx, sy);
        await tween(clamp(len * 2.2, 260, 1200) * density, (t) => {
          const l = len * easeOut(t);
          g.style.strokeDashoffset = `${len - l}`;
          const [x, y] = at(l);
          place(a, x, y);
        });
        g.style.strokeDasharray = "";
        g.style.strokeDashoffset = "";
      }
    };

    // ---------------------------------------------------------- follow mode

    /**
     * Each cursor orbits the target on its own ring (radius, speed, phase),
     * pulled there by a damped spring, so the crew trails the pointer as a
     * loose swirl rather than snapping to it. Close neighbours push apart so
     * the name tags stay readable. Runs only while the section is on screen.
     */
    const startFollow = (crew: Agent[]): (() => void) => {
      type Body = Agent & {
        vx: number;
        vy: number;
        ring: number;
        theta: number;
        omega: number;
        k: number;
        /** Current tilt of the arrow, degrees; 0 is the normal pointer pose. */
        angle: number;
      };
      const makeBody = (a: Agent): Body =>
        Object.assign(a, {
          vx: 0,
          vy: 0,
          ring: rand(56, 170),
          theta: rand(0, Math.PI * 2),
          omega: rand(0.55, 1.25) * (Math.random() < 0.82 ? 1 : -1),
          k: rand(7, 15),
          angle: 0,
        });
      const bodies: Body[] = crew.map(makeBody);
      for (const b of bodies) shape(b, "arrow");

      let pointer: { x: number; y: number } | null = null;
      const onMove = (e: PointerEvent): void => {
        if (e.pointerType === "touch") return;
        pointer = { x: e.clientX, y: e.clientY };
      };
      const onLeave = (e: MouseEvent): void => {
        if (!e.relatedTarget) pointer = null;
      };
      const onVisibility = (): void => {
        if (!document.hidden && visible && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("mouseout", onLeave);
      document.addEventListener("visibilitychange", onVisibility);

      let visible = true;
      const io = new IntersectionObserver((es) => {
        visible = es.some((e) => e.isIntersecting);
        if (visible && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      });
      io.observe(root);

      const target = Math.max(bodies.length, Math.round(o.followAgents));
      let spawnAt = 0;
      let last = performance.now();
      let clock = 0;
      let raf = 0;

      const tick = (now: number): void => {
        raf = 0;
        if (!visible || document.hidden) {
          last = now;
          return;
        }
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        clock += dt;

        const box = root.getBoundingClientRect();
        const w = box.width;
        const h = box.height;
        const inside =
          pointer !== null &&
          pointer.x >= box.left &&
          pointer.x <= box.right &&
          pointer.y >= box.top &&
          pointer.y <= box.bottom;
        const tx = inside
          ? pointer!.x - box.left
          : w * (0.5 + 0.3 * Math.sin(clock * 0.31));
        const ty = inside
          ? pointer!.y - box.top
          : h * (0.5 + 0.28 * Math.sin(clock * 0.43 + 1.3));

        // Stream extra cursors in from the sides until the crew is full.
        if (bodies.length < target && clock > spawnAt) {
          spawnAt = clock + 0.12;
          const left = Math.random() < 0.5;
          bodies.push(
            makeBody(spawn(left ? -30 : w + 30, rand(0.15, 0.85) * h))
          );
        }

        for (let i = 0; i < bodies.length; i++) {
          const b = bodies[i]!;
          b.theta += b.omega * dt;
          const r = b.ring * (1 + 0.16 * Math.sin(clock * 0.8 + i * 1.7));
          const dx = tx + Math.cos(b.theta) * r - b.x;
          const dy = ty + Math.sin(b.theta) * r * 0.78 - b.y;
          const damp = 2 * Math.sqrt(b.k) * 0.72;
          let ax = b.k * dx - damp * b.vx;
          let ay = b.k * dy - damp * b.vy;
          for (let j = 0; j < bodies.length; j++) {
            if (j === i) continue;
            const q = bodies[j]!;
            const sx = b.x - q.x;
            const sy = b.y - q.y;
            const d = Math.hypot(sx, sy);
            if (d > 0.01 && d < 30) {
              const push = 900 * (1 - d / 30);
              ax += (sx / d) * push;
              ay += (sy / d) * push;
            }
          }
          b.vx += ax * dt;
          b.vy += ay * dt;
          const v = Math.hypot(b.vx, b.vy);
          if (v > 1600) {
            b.vx *= 1600 / v;
            b.vy *= 1600 / v;
          }
          place(b, b.x + b.vx * dt, b.y + b.vy * dt);

          // Bank into the turn: the arrow's tip faces its direction of travel
          // (the drawn arrow points ~120° from +x, hence the offset), easing
          // back to the upright pointer pose when it slows down.
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > 60) {
            const want = (Math.atan2(b.vy, b.vx) * 180) / Math.PI + 120;
            const diff = ((((want - b.angle + 180) % 360) + 360) % 360) - 180;
            b.angle += diff * Math.min(1, dt * 8);
          } else {
            b.angle *= 1 - Math.min(1, dt * 6);
          }
          b.angle = ((((b.angle + 180) % 360) + 360) % 360) - 180;
          b.icon.style.transform = `translate(-4px,-3px) rotate(${b.angle.toFixed(1)}deg)`;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      return () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        visible = false;
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("mouseout", onLeave);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    };

    // ---------------------------------------------------------- choreography

    try {
      // 1. Lead selects everything and deletes it.
      const lead = spawn(-30, -30, "You");
      await move(lead, 10, 10, 520);
      shape(lead, "cross");
      const marquee = el(
        `z-index:2;transform:translate(10px,10px);width:0;height:0;border:1px solid ${o.selection};background:${o.selection}1f`
      );
      await tween(620, (t) => {
        const e = easeInOut(t);
        marquee.style.width = `${(W - 20) * e}px`;
        marquee.style.height = `${(H - 20) * e}px`;
        place(lead, 10 + (W - 20) * e, 10 + (H - 20) * e);
      });
      const key = el(
        `z-index:4;transform:translate(${W - 120}px,${H - 64}px);background:#111;color:#fff;font-size:12px;padding:6px 9px;border-radius:7px;box-shadow:0 6px 20px rgba(0,0,0,.35)`,
        `<span class="${o.labelClassName}">⌫ Delete</span>`
      );
      fadeIn(key, 140);
      await sleep(260);
      for (const p of pieces) hide(p);
      fadeOutRemove(marquee, 200);
      fadeOutRemove(key, 400);
      await sleep(240);

      // 2. The swarm flies in from the edges.
      const crew: Agent[] = [lead];
      shape(lead, "arrow");
      const n = clamp(Math.round(o.agents), 1, 24);
      for (let i = 0; i < n; i++) {
        const side = i % 4;
        const x = side === 0 ? -30 : side === 1 ? W + 30 : rand(0, W);
        const y = side === 2 ? -30 : side === 3 ? H + 30 : rand(0, H);
        crew.push(spawn(x, y));
      }

      // 3. Everyone takes the nearest available piece whose parent is built.
      const pick = (a: Agent): Piece | null => {
        const ready: Piece[] = [];
        for (const p of pieces) {
          if (p.taken) continue;
          if (p.parent && !p.parent.done) continue;
          if (p.dupOf && !p.dupOf.done) continue;
          ready.push(p);
          if (ready.length >= 6) break;
        }
        if (!ready.length) return null;
        let best = ready[0]!;
        let bestD = Infinity;
        for (const p of ready) {
          const d = Math.hypot(p.x - a.x, p.y - a.y) + pieces.indexOf(p) * 6;
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        return best;
      };

      const worker = async (a: Agent, delay: number): Promise<void> => {
        await sleep(delay);
        for (;;) {
          const p = pick(a);
          if (!p) {
            if (pieces.every((q) => q.taken)) return;
            await sleep(70);
            continue;
          }
          p.taken = true;
          if (p.dupOf) await buildDup(a, p, p.dupOf);
          else if (p.kind === "text") await buildText(a, p);
          else if (p.kind === "pen") await buildPen(a, p);
          else await buildBox(a, p, p.kind === "media");
          p.done = true;
          shape(a, "arrow");
          if (Math.random() < 0.25) {
            await move(a, a.x + rand(-40, 40), a.y + rand(-30, 30), 260);
          }
        }
      };

      await Promise.all(crew.map((a, i) => worker(a, i * 70)));
      await sleep(250);

      // 4a. Follow mode: hand the real DOM back, keep the crew, and let it
      // swirl around the visitor's pointer until the next rebuild.
      if (o.follow) {
        restorePieces();
        stopFollow = startFollow(crew);
        o.onComplete?.();
        return;
      }

      // 4b. Fly out and hand the real DOM back untouched.
      await Promise.all(
        crew.map((a) => {
          const side = Math.floor(Math.random() * 4);
          const x = side === 0 ? -40 : side === 1 ? W + 40 : a.x;
          const y = side === 2 ? -40 : side === 3 ? H + 40 : a.y;
          return move(a, x, y, rand(500, 800));
        })
      );
      restore();
      runRef.current = null;
      o.onComplete?.();
    } catch (err) {
      if (err !== ABORT) {
        restore();
        throw err;
      }
    }
  }, []);

  // Autoplay once when scrolled into view.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || autoplay !== "inView") return;
    if (!isMotionAllowed()) return;
    // "Enough of it is on screen": 35% of the section, or — for sections
    // taller than the viewport (phones), where 35% may never fit — half of
    // the viewport filled by it.
    const io = new IntersectionObserver(
      (entries) => {
        const go = entries.some((e) => {
          if (!e.isIntersecting) return false;
          const vh = e.rootBounds?.height ?? window.innerHeight;
          return (
            e.intersectionRatio >= 0.35 || e.intersectionRect.height >= vh * 0.5
          );
        });
        if (go) {
          io.disconnect();
          void run();
        }
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.35, 0.5] }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [autoplay, run]);

  // The site Motion toggle (or the OS setting) switching off stops the swarm
  // at once and hands the section back.
  useEffect(
    () =>
      onMotionChange(() => {
        if (!isMotionAllowed()) {
          runRef.current?.abort();
          runRef.current = null;
        }
      }),
    []
  );

  // A resize invalidates every measured rect: stop and restore.
  useEffect(() => {
    let w = window.innerWidth;
    const onResize = (): void => {
      if (window.innerWidth === w) return;
      w = window.innerWidth;
      runRef.current?.abort();
      runRef.current = null;
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      runRef.current?.abort();
      runRef.current = null;
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative isolate ${className ?? ""}`}>
      <div ref={contentRef}>{children}</div>
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[60] overflow-hidden"
      />
      {replay ? (
        <button
          type="button"
          data-swarm-skip
          onClick={() => void run()}
          className={
            replayClassName ??
            "absolute top-4 right-4 z-[61] rounded-full border border-current/20 bg-black/40 px-3 py-1.5 text-xs text-white backdrop-blur transition hover:bg-black/60"
          }
        >
          {replay === true ? "↻ Rebuild" : replay}
        </button>
      ) : null}
    </div>
  );
}
