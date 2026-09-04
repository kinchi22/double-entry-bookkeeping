// VIOLATION: persistence is an adapter concern. Everything else in core stays
// runtime-agnostic.
// Expected gate: dependency-cruiser, rule only-adapters-touch-db.
import { ledgerTable } from '../../../../db/src/index';

export const table = ledgerTable;
