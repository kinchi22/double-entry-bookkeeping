/**
 * VIOLATION: a schema change with no migration to match it.
 *
 * tools/verify-migration-gate.mjs appends this to packages/db/src/schema.ts,
 * runs the drift check, and restores the original. The drift check must report
 * that a migration is missing.
 *
 * Appended rather than substituted, so what is planted is always one table
 * added to the schema as it stands. Replacing the file would delete every real
 * table at the same time, and drizzle-kit resolves a create beside a drop by
 * asking whether the table was renamed -- a question it cannot ask with no TTY.
 * It fails there and writes nothing, which reads exactly like no drift.
 *
 * The imports are aliased because the real schema already binds those names,
 * and a module cannot bind one name twice.
 *
 * The table is deliberately meaningless: a fixture is here to break a gate, not
 * to hold a guess about the product.
 *
 * Expected gate: pnpm db:drift.
 */
import {
  pgTable as gatePgTable,
  text as gateText,
  timestamp as gateTimestamp,
  uuid as gateUuid,
} from 'drizzle-orm/pg-core';

export const gateProbe = gatePgTable('gate_probe', {
  id: gateUuid('id').primaryKey(),
  label: gateText('label').notNull(),
  createdAt: gateTimestamp('created_at', { withTimezone: true }).notNull(),
});
