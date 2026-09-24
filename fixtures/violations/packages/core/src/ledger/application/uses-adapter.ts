import { findLedgerRow, type LedgerRow } from '../adapters/repository';

export function loadRow(id: string): LedgerRow {
  return findLedgerRow(id);
}
