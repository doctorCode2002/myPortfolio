#!/usr/bin/env node
/**
 * Character portraits for the "Change character" button (components/game/picker3d/character-portrait.tsx).
 *
 * Opens the dev-only page /en/play/portraits (components/game/picker3d/portrait-studio.tsx) in headless Chromium,
 * which renders each picker character's head and shoulders on a transparent 128x128 canvas and exposes the PNGs as
 * data URLs in the DOM; this script reads them over the DevTools protocol and writes public/game3d/portraits/<charId>.png.
 *
 * Needs the dev server running (it is never started here) and a Chromium/Chrome binary.
 *
 * Usage:
 *   node scripts/3d/portraits.mjs [--url=http://localhost:3200/en/play/portraits] [--chrome=/usr/bin/chromium]
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...v] = a.slice(2).split("=");
      return [k, v.join("=") || "true"];
    })
);

const URL_ = args.url ?? "http://localhost:3200/en/play/portraits";
const OUT = path.resolve(import.meta.dirname, "../../public/game3d/portraits");
const CANDIDATES = [
  args.chrome,
  process.env.CHROME_BIN,
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

async function findChrome() {
  for (const c of CANDIDATES) {
    try {
      await fs.access(c);
      return c;
    } catch {
      // try the next one
    }
  }
  throw new Error("No Chromium/Chrome found; pass --chrome=/path/to/chrome");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimal Chrome DevTools Protocol client over Node's built-in WebSocket. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data));
    const p = msg.id ? pending.get(msg.id) : null;
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.rej(new Error(msg.error.message));
    else p.res(msg.result);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((res, rej) => pending.set(id, { res, rej }));
    },
    close: () => ws.close(),
  };
}

async function main() {
  const chrome = await findChrome();
  const port = 9300 + Math.floor(Math.random() * 500);
  const userDir = await fs.mkdtemp(path.join(os.tmpdir(), "portraits-"));
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDir}`,
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--no-first-run",
      "--window-size=900,400",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      try {
        const list = await (
          await fetch(`http://127.0.0.1:${port}/json`)
        ).json();
        target = list.find((t) => t.type === "page") ?? null;
      } catch {
        // not up yet
      }
    }
    if (!target) throw new Error("Chromium did not start");
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.navigate", { url: URL_ });

    const read = async () => {
      const { result } = await cdp.send("Runtime.evaluate", {
        returnByValue: true,
        expression: `[...document.querySelectorAll("[data-portrait]")].map((el) => [el.dataset.portrait, el.textContent])`,
      });
      return (result.value ?? []).filter(([, url]) =>
        url?.startsWith("data:image/png")
      );
    };

    let found = [];
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      found = await read();
      if (found.length >= 6) break;
    }
    cdp.close();
    if (found.length === 0) {
      throw new Error(
        `No portraits in ${URL_} (is the dev server running, and did the models load?)`
      );
    }
    await fs.mkdir(OUT, { recursive: true });
    for (const [id, dataUrl] of found) {
      const png = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
      const file = path.join(OUT, `${id}.png`);
      await fs.writeFile(file, png);
      console.log(`${path.relative(process.cwd(), file)}  ${png.length} bytes`);
    }
  } finally {
    proc.kill();
    await fs.rm(userDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
