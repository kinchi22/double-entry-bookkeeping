// VIOLATION: an unused binding is either a mistake or a leftover.
// Expected gate: eslint, rule @typescript-eslint/no-unused-vars.
export function total(debits: number, credits: number): number {
  const difference = debits - credits;
  return debits + credits;
}
