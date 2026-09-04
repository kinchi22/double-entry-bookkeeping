// VIOLATION: a use case depends on a port, never on the implementation behind
// it. Swapping the adapter would otherwise change the use case.
// Expected gate: dependency-cruiser, rule application-not-to-adapters.
import { findLedgerRow, type LedgerRow } from '../adapters/repository';

export function loadRow(id: string): LedgerRow {
  return findLedgerRow(id);
}
