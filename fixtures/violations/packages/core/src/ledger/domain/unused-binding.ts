export function total(debits: number, credits: number): number {
  const difference = debits - credits;
  return debits + credits;
}
