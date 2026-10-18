/**
 * A small synthesized chime (no sample to license or load): a few sine partials of a
 * major arpeggio with soft attacks and exponential decays. `pitch` shifts it (a lower,
 * shorter one for lighting a signal fire).
 */
export function playChime(
  ctx: AudioContext,
  out: AudioNode,
  strength = 1,
  pitch = 1
): void {
  const now = ctx.currentTime;
  const notes = [1318.5, 1661.2, 1975.5, 2637]; // E6, G#6, B6, E7
  const gain = 0.09 * Math.max(0, Math.min(1, strength));
  notes.forEach((f, i) => {
    const t = now + i * 0.07;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f * pitch;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 1);
  });
}
