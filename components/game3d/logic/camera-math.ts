/** Follow-camera limits and helpers. Pure. */

export const CAMERA = {
  /** Yaw offset limits around the default heading (radians). */
  yawLimit: (60 * Math.PI) / 180,
  pitchMin: (30 * Math.PI) / 180,
  pitchMax: (65 * Math.PI) / 180,
  pitchDefault: (45 * Math.PI) / 180,
  /** Zoom factor limits; the camera distance is baseDistance / zoom. */
  zoomMin: 1,
  zoomMax: 4,
  zoomDefault: 2,
  baseDistance: 24,
  zoomLevels: [1, 1.5, 2, 3, 4] as const,
} as const;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clampYaw(yaw: number): number {
  return clamp(yaw, -CAMERA.yawLimit, CAMERA.yawLimit);
}

export function clampPitch(pitch: number): number {
  return clamp(pitch, CAMERA.pitchMin, CAMERA.pitchMax);
}

export function clampZoom(zoom: number): number {
  return clamp(zoom, CAMERA.zoomMin, CAMERA.zoomMax);
}

export function zoomToDistance(zoom: number): number {
  return CAMERA.baseDistance / clampZoom(zoom);
}

/** Next zoom level up (+1) or down (-1) from a possibly in-between zoom. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const levels = CAMERA.zoomLevels;
  if (dir > 0) {
    for (const l of levels) if (l > zoom + 1e-3) return l;
    return levels[levels.length - 1] as number;
  }
  for (let i = levels.length - 1; i >= 0; i--) {
    const l = levels[i] as number;
    if (l < zoom - 1e-3) return l;
  }
  return levels[0] as number;
}

/** Frame-rate independent exponential damping factor. */
export function damp(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
}

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Camera-relative movement: turn input (x right, y forward) into a world (dx, dz) given the
 * camera's heading `yaw` (0 means the camera looks towards -z, i.e. north).
 */
export function cameraRelative(
  inputX: number,
  inputY: number,
  yaw: number
): { x: number; z: number } {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return { x: rx * inputX + fx * inputY, z: rz * inputX + fz * inputY };
}
