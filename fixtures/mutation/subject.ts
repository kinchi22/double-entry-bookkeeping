/**
 * Stand-in for a piece of domain logic. Deliberately branchy so that Stryker has
 * real mutants to generate: swap the comparison, flip the operator, replace a
 * return value.
 */
export type BalanceState = 'balanced' | 'unbalanced';

export function classifyBalance(debitsMinor: number, creditsMinor: number): BalanceState {
  if (debitsMinor === creditsMinor) {
    return 'balanced';
  }
  return 'unbalanced';
}
