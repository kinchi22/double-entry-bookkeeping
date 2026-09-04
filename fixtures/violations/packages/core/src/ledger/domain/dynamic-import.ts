// VIOLATION: import() outside the composition root hides the dependency graph
// from every static gate in this repo.
// Expected gate: eslint, rule no-restricted-syntax (ImportExpression).
export async function lazyZero(): Promise<number> {
  const amount = await import('./amount');
  return amount.LEDGER_ZERO;
}
