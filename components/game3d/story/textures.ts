/**
 * Small canvas textures for the island stories: a shared soft radial glow, and the
 * placeholder screen shown while a screenshot loads or when it is missing.
 */

import * as THREE from "three";

let glow: THREE.CanvasTexture | null = null;

/** A white radial falloff (tinted by the material colour); created once and shared. */
export function glowTexture(): THREE.CanvasTexture | null {
  if (glow) return glow;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.45, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(c);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}

/** A 16:9 card with the project title, used until (or instead of) the screenshot. */
export function placeholderScreen(
  title: string,
  subtitle: string,
  accent: string
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 288;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 512, 288);
  g.addColorStop(0, "#1d2230");
  g.addColorStop(1, accent);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 288);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.fillText(title, 256, 128, 460);
  ctx.globalAlpha = 0.75;
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(subtitle, 256, 186, 460);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
