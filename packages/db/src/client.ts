import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema, type Schema } from './schema';

export type Database = NodePgDatabase<Schema>;

export function createDatabase(connectionString: string): {
  database: Database;
  close: () => Promise<void>;
} {
  const pool = new Pool({ connectionString });
  return {
    database: drizzle(pool, { schema }),
    close: async () => {
      await pool.end();
    },
  };
}
