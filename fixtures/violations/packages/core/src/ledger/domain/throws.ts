// VIOLATION: domain must return Result<T, DomainError>, never throw.
// Expected gate: eslint, rule no-restricted-syntax.
export function requirePositive(amount: number): number {
  if (amount <= 0) {
    throw new Error('amount must be positive');
  }
  return amount;
}
