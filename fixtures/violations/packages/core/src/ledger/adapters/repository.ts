export type LedgerRow = { readonly id: string };

export function findLedgerRow(id: string): LedgerRow {
  return { id };
}
