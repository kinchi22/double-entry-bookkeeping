// VIOLATION: domain reaching outward into adapters. Dependencies point inward.
// Expected gate: eslint, rule boundaries/dependencies.
import { findLedgerRow, type LedgerRow } from '../adapters/repository';

export function loadRow(id: string): LedgerRow {
  return findLedgerRow(id);
}
