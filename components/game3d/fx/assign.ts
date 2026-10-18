/**
 * Per-frame writes to three objects held in hooks (uniform values, material fields).
 * Routed through a function so frame callbacks can update render state that React's
 * compiler rules treat as immutable hook values.
 */
export function assign<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K]
): void {
  target[key] = value;
}

/** Set a shader uniform's value. */
export function setUniform<T>(uniform: { value: T }, value: T): void {
  uniform.value = value;
}
