export function requirePositive(amount: number): number {
  if (amount <= 0) {
    throw new Error('amount must be positive');
  }
  return amount;
}
