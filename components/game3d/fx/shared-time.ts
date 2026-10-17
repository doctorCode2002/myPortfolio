/**
 * Shared shader uniforms driven by one clock (see <ShaderClock/>): every patched material
 * reads the same objects, so a single useFrame updates them all.
 */

export const sharedUniforms = {
  uTime: { value: 0 },
  /** 0 under prefers-reduced-motion, 1 otherwise. */
  uMotion: { value: 1 },
};
