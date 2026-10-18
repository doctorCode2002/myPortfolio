/**
 * The balloon burner's whoosh, synthesized (no sample to license or load): a burst of
 * noise through a low band-pass with a soft attack and release. The system asks for one
 * every ~0.4 s while the burner fires, and the overlapping bursts make a steady roar.
 */

const noise = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const have = noise.get(ctx);
  if (have) return have;
  const len = Math.floor(ctx.sampleRate * 0.8);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Brown-ish noise (integrated white): a deeper, softer roar than white noise.
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.08) * 0.985;
    d[i] = last * 3.2;
  }
  noise.set(ctx, buf);
  return buf;
}

export function playBurner(
  ctx: AudioContext,
  out: AudioNode,
  strength = 1
): void {
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 420 + strength * 260;
  band.Q.value = 0.7;
  const g = ctx.createGain();
  const peak = 0.16 * Math.max(0, Math.min(1, strength));
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(peak, now + 0.12);
  g.gain.setValueAtTime(peak, now + 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
  src.connect(band);
  band.connect(g);
  g.connect(out);
  src.start(now);
  src.stop(now + 0.8);
}
