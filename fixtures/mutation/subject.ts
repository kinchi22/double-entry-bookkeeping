export type BalanceState = 'balanced' | 'unbalanced';

export function classifyBalance(debitsMinor: number, creditsMinor: number): BalanceState {
  if (debitsMinor === creditsMinor) {
    return 'balanced';
  }
  return 'unbalanced';
}
