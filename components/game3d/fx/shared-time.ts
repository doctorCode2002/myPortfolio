/**
 * Shared shader uniforms driven by one clock (see <ShaderClock/>): every patched material
 * reads the same objects, so a single useFrame updates them all.
 */

export const sharedUniforms = {
  uTime: { value: 0 },
  /** 0 under prefers-reduced-motion, 1 otherwise. */
  uMotion: { value: 1 },
  /** 0..1 night amount (lit windows, glowing lamps); set by the atmosphere system. */
  uNight: { value: 0 },
  /** 0..1 rain strength (wet sheen, ripples). */
  uRain: { value: 0 },
  /** 0..1 wind gust strength (stronger foliage sway). */
  uGust: { value: 0 },
};
