// VIOLATION: branching in a route handler is a decision, and decisions are
// domain logic. The complexity cap is what pushes them into core.
// Expected gate: eslint, rule complexity.
export function classifyAmount(amount: number): string {
  if (amount < 0) return 'negative';
  if (amount === 0) return 'zero';
  if (amount < 1_000) return 'small';
  if (amount < 100_000) return 'medium';
  return 'large';
}
