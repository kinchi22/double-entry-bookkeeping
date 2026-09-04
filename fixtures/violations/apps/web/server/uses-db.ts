// VIOLATION: apps/web reaches the database only through a core adapter, wired
// in the composition root.
// Expected gate: dependency-cruiser, rule web-not-to-db.
import { ledgerTable } from '../../../packages/db/src/index';

export const table = ledgerTable;
