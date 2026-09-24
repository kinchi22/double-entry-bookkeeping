export async function lazyZero(): Promise<number> {
  const amount = await import('./amount');
  return amount.LEDGER_ZERO;
}
