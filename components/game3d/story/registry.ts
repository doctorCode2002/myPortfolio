/**
 * Which mayors can offer a tour right now (they have a tour and are not giving one).
 * Written by the mayors, read when the player talks to one (interactions.tsx).
 */

const offering = new Set<string>();

export function setTourOffer(mayorId: string, on: boolean): void {
  if (on) offering.add(mayorId);
  else offering.delete(mayorId);
}

export function canOfferTour(mayorId: string): boolean {
  return offering.has(mayorId);
}

/** Prompt heights (metres above the item) for story interactables (the screen, the rack). */
const promptLifts = new WeakMap<object, number>();

export function setPromptLift(item: object, lift: number): void {
  promptLifts.set(item, lift);
}

export function promptLift(item: object): number | undefined {
  return promptLifts.get(item);
}
