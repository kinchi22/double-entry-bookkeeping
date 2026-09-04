// VIOLATION: a module nothing imports is either dead code or wiring that was
// never finished. Both are worth failing on.
// Expected gate: dependency-cruiser, rule no-orphans.
export const unreachableConstant = 'nothing imports this';
