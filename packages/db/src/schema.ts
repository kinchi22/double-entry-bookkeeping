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

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

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

export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey(),
    entryDate: date('entry_date').notNull(),
    memo: text('memo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('entries_user_id_idx').on(table.userId)],
);

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
