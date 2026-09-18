import {
  bigint,
  date,
  index,
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
 * A person who keeps books here. ADR-0021.
 *
 * `email` and `name` are what Google said at the last sign-in, kept for display.
 * Neither identifies anyone -- an email can change hands -- so neither is
 * unique, and a User is found through `identities`. `name` is nullable because
 * Google does not promise one.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

/**
 * One way a User signs in: a provider and that provider's subject for the
 * person, Google's `sub` today. The pair is the key, so one Google account is
 * one User. ADR-0021.
 */
export const identities = pgTable(
  'identities',
  {
    provider: text('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerSubject] }),
    index('identities_user_id_idx').on(table.userId),
  ],
);

/**
 * A signed-in User. ADR-0021.
 *
 * The cookie carries a random token and this table only its SHA-256 hash, hex
 * encoded, so a read of the table signs nobody in. Signing out deletes the row.
 */
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

/**
 * One posting. ADR-0010.
 *
 * `entry_date` is the day the transaction is posted, and the only column here
 * that is not a `timestamptz`: a day holds no time, so there is nothing to
 * convert. `created_at` is an instant, supplied by the use case from an injected
 * clock rather than by a database default, so the same code produces the same
 * row in a test.
 */
export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey(),
    entryDate: date('entry_date').notNull(),
    memo: text('memo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    /**
     * The User whose books the entry is in. ADR-0021. It was nullable while the
     * code before `milestone/authentication` wrote no owner; the migration that
     * set `NOT NULL` first deleted the entries still without one, which was the
     * wipe ADR-0009 promised.
     */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('entries_user_id_idx').on(table.userId)],
);

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
 *
 * Deleting an entry deletes its lines, so deleting a User deletes their books
 * (ADR-0021). Nothing deletes an entry otherwise.
 */
export const entryLines = pgTable(
  'entry_lines',
  {
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    lineNumber: smallint('line_number').notNull(),
    account: text('account').notNull(),
    side: text('side').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.entryId, table.lineNumber] })],
);

export const schema = { users, identities, sessions, entries, entryLines } as const;

export type Schema = typeof schema;
