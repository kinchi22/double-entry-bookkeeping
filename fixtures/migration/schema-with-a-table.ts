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
