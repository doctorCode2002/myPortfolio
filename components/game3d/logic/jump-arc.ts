/**
 * Ballistic arcs for the jump pads: from a pad to a precomputed landing spot, over an apex
 * high enough to clear everything solid underneath (terrain columns, buildings, lookouts,
 * props), checked by sampling. Pure: no three or react imports.
 */

export type Point3 = { x: number; y: number; z: number };

/** Gravity of the pad arcs (m/s², a little floaty). */
export const JUMP_G = 18;

export type JumpArc = {
  from: Point3;
  to: Point3;
  /** Highest point of the flight (world y). */
  apex: number;
  /** Vertical launch speed (m/s). */
  vy0: number;
  /** Flight time (s). */
  duration: number;
  g: number;
};

/** The arc from `from` to `to` that tops out at `apex` (raised to clear both ends). */
export function makeArc(
  from: Point3,
  to: Point3,
  apex: number,
  g = JUMP_G
): JumpArc {
  const top = Math.max(apex, from.y + 0.2, to.y + 0.2);
  const vy0 = Math.sqrt(2 * g * (top - from.y));
  const up = vy0 / g;
  const down = Math.sqrt((2 * (top - to.y)) / g);
  return {
    from: { ...from },
    to: { ...to },
    apex: top,
    vy0,
    duration: up + down,
    g,
  };
}

/** Position on the arc after `t` seconds (clamped to the flight), written into `out`. */
export function arcPoint(arc: JumpArc, t: number, out: Point3): Point3 {
  const c = Math.min(arc.duration, Math.max(0, t));
  const k = arc.duration > 0 ? c / arc.duration : 1;
  out.x = arc.from.x + (arc.to.x - arc.from.x) * k;
  out.z = arc.from.z + (arc.to.z - arc.from.z) * k;
  out.y =
    c >= arc.duration
      ? arc.to.y
      : arc.from.y + arc.vy0 * c - 0.5 * arc.g * c * c;
  return out;
}

/** Height of whatever is solid at a plan-view point (-Infinity over the void). */
export type SolidTop = (x: number, z: number) => number;

const AROUND = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)] as const;
});

/**
 * The smallest gap between the arc and the solid tops under it (sampled, with a body of
 * `radius` around each sample). Samples within `endSkip` metres (plan view) of either end
 * are skipped: the flight starts and ends on those surfaces.
 */
export function arcClearance(
  arc: JumpArc,
  top: SolidTop,
  radius = 0.3,
  samples = 48,
  endSkip = 0.75
): number {
  let worst = Infinity;
  const p: Point3 = { x: 0, y: 0, z: 0 };
  for (let i = 1; i < samples; i++) {
    arcPoint(arc, (i / samples) * arc.duration, p);
    const d0 = Math.hypot(p.x - arc.from.x, p.z - arc.from.z);
    const d1 = Math.hypot(p.x - arc.to.x, p.z - arc.to.z);
    if (d0 < endSkip || d1 < endSkip) continue;
    let h = top(p.x, p.z);
    for (const [dx, dz] of AROUND)
      h = Math.max(h, top(p.x + dx * radius, p.z + dz * radius));
    worst = Math.min(worst, p.y - h);
  }
  return worst;
}

/**
 * Plan the arc for a pad: start with an apex a little above the higher end (more for long
 * hops) and raise it until the sampled clearance is at least `margin`. Returns the arc and
 * its clearance (the caller's test asserts it is positive).
 */
export function planArc(
  from: Point3,
  to: Point3,
  top: SolidTop,
  margin = 0.25
): { arc: JumpArc; clearance: number } {
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  let apex = Math.max(from.y, to.y) + 1.4 + dist * 0.12;
  let arc = makeArc(from, to, apex);
  let clearance = arcClearance(arc, top);
  for (let i = 0; i < 24 && clearance < margin; i++) {
    apex += 0.5;
    arc = makeArc(from, to, apex);
    clearance = arcClearance(arc, top);
  }
  return { arc, clearance };
}
