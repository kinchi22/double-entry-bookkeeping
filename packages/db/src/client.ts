import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema, type Schema } from './schema';

export type Database = NodePgDatabase<Schema>;

/**
 * The connection string is an argument, not an ambient read of process.env.
 *
 * That is what lets an integration test point this at a throwaway container and
 * lets the AWS migration change only who calls this function.
 */
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
