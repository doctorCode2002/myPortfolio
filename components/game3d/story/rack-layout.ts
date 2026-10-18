/**
 * Slot layout of the forge's tech rack: one slot per technology, in data order from left
 * to right, alternating between the shelves so every slot has its own x (the label can
 * follow the player along the rack). Pure.
 */

export type RackSlot = { x: number; y: number; tilt: number };

export function rackSlots(
  count: number,
  shelves: readonly number[],
  postX: number,
  margin = 0.12
): RackSlot[] {
  const width = 2 * (postX - margin);
  const levels = shelves.length > 0 ? [...shelves].reverse() : [0];
  const step = count > 0 ? width / count : 0;
  return Array.from({ length: count }, (_, i) => ({
    x: -width / 2 + (i + 0.5) * step,
    y: levels[i % levels.length] as number,
    tilt: (((i * 37) % 7) - 3) * 0.05,
  }));
}
