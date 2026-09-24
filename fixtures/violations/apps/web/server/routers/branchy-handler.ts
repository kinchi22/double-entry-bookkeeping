export function classifyAmount(amount: number): string {
  if (amount < 0) return 'negative';
  if (amount === 0) return 'zero';
  if (amount < 1_000) return 'small';
  if (amount < 100_000) return 'medium';
  return 'large';
}
