import { sql } from 'drizzle-orm';
import { createDatabase } from '@repo/db';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
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
 * becomes `false` rather than propagating. Why it failed is logged, because
 * `false` alone cannot tell a sleeping database from a wrong URL. ADR-0018.
 */
export function createPostgresHealthProbe(
  connectionString: string,
  logger: Logger,
): PostgresHealthProbe {
  const { database, close } = createDatabase(connectionString);

  return {
    name: 'postgres',
    check: async (): Promise<boolean> => {
      try {
        await database.execute(sql`select 1`);
        return true;
      } catch (error) {
        logger.error(
          { event: 'health.probe_unreachable', component: 'postgres', error: describeError(error) },
          'The health probe could not reach Postgres.',
        );
        return false;
      }
    },
    close,
  };
}
