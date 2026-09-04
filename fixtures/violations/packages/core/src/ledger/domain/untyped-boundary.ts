// VIOLATION: an exported function without an explicit return type lets the
// public surface of a module change silently through inference.
// Expected gate: eslint, rule @typescript-eslint/explicit-module-boundary-types.
export function passThrough(value: string) {
  return value;
}
