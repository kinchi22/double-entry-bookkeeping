import { sql } from 'drizzle-orm';
import { createDatabase } from '@repo/db';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
import { type HealthProbe } from '../ports/health-probe';

export type PostgresHealthProbe = HealthProbe & {
  close: () => Promise<void>;
};

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
