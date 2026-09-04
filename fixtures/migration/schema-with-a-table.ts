/**
 * VIOLATION: a schema change with no migration to match it.
 *
 * tools/verify-migration-gate.mjs copies this over packages/db/src/schema.ts,
 * runs the drift check, and restores the original. The drift check must report
 * that a migration is missing.
 *
 * The table is deliberately meaningless. Inventing a real one here would put a
 * guess about the product into the fixture directory, and Phase 1 adds the
 * first real table alongside the acceptance criterion that justifies it.
 *
 * Expected gate: pnpm db:drift.
 */
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const gateProbe = pgTable('gate_probe', {
  id: uuid('id').primaryKey(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const schema = { gateProbe } as const;

export type Schema = typeof schema;
