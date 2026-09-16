import {
  bigint,
  date,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Drizzle schema.
 *
 * Two standing rules for anything added here:
 *   - timestamps are `timestamptz`, stored in UTC, converted only at display
 *   - money is stored as an integer count of minor units, never a float
 */

/**
 * One posting. ADR-0010.
 *
 * `entry_date` is the day the transaction is posted, and the only column here
 * that is not a `timestamptz`: a day holds no time, so there is nothing to
 * convert. `created_at` is an instant, supplied by the use case from an injected
 * clock rather than by a database default, so the same code produces the same
 * row in a test.
 */
export const entries = pgTable('entries', {
  id: uuid('id').primaryKey(),
  entryDate: date('entry_date').notNull(),
  memo: text('memo').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

/**
 * The lines of an entry, which is where its balance lives. ADR-0010.
 *
 * A line has no id of its own: nothing addresses a line, and entries are
 * append-only. `line_number` completes the key and keeps the order the lines
 * were entered in.
 *
 * `amount` is a `bigint` read as a number, and is always greater than zero --
 * direction is `side`, never the sign. The column types state the shape; the
 * rules that make a set of lines an entry, the balance included, are decided in
 * `packages/core/src/entries/domain` and nowhere else. No trigger checks them.
 */
export const entryLines = pgTable(
  'entry_lines',
  {
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id),
    lineNumber: smallint('line_number').notNull(),
    account: text('account').notNull(),
    side: text('side').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.entryId, table.lineNumber] })],
);

export const schema = { entries, entryLines } as const;

export type Schema = typeof schema;
