import { sql } from 'drizzle-orm';
import { createDatabase } from '@repo/db';
import { type HealthProbe } from '../ports/health-probe';

export type PostgresHealthProbe = HealthProbe & {
  close: () => Promise<void>;
};

/**
 * The only file in this feature that knows a database exists.
 *
 * It takes a connection string rather than a Database, because the composition
 * root in apps/web is forbidden by the dependency matrix from importing
 * @repo/db at all. Configuration crosses the boundary; infrastructure does not.
 *
 * Unreachability is a normal answer here, not an exception, so a failed query
 * becomes `false` rather than propagating.
 */
export function createPostgresHealthProbe(connectionString: string): PostgresHealthProbe {
  const { database, close } = createDatabase(connectionString);

  return {
    name: 'postgres',
    check: async (): Promise<boolean> => {
      try {
        await database.execute(sql`select 1`);
        return true;
      } catch {
        return false;
      }
    },
    close,
  };
}
