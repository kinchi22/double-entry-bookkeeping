import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { createPostgresHealthProbe } from './postgres-health-probe';

const databaseUrl = process.env['TEST_DATABASE_URL'];
if (databaseUrl === undefined) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Run integration tests with `pnpm test:integration`, ' +
      'which starts the Postgres container this suite needs.',
  );
}

const UNREACHABLE_URL = 'postgresql://absent:absent@127.0.0.1:1/absent';

const logged: LogFields[] = [];
const logger: Logger = {
  error: (fields) => {
    logged.push(fields);
  },
};

beforeEach(() => {
  logged.length = 0;
});

const live = createPostgresHealthProbe(databaseUrl, logger);
const dead = createPostgresHealthProbe(UNREACHABLE_URL, logger);

afterAll(async () => {
  await Promise.all([live.close(), dead.close()]);
});

describe('createPostgresHealthProbe', () => {
  it('reports the component name the health slice aggregates on', () => {
    expect(live.name).toBe('postgres');
  });

  it('reports reachable when a real database answers the query', async () => {
    await expect(live.check()).resolves.toBe(true);
  });

  it('reports unreachable rather than throwing when nothing is listening', async () => {
    await expect(dead.check()).resolves.toBe(false);
  });

  it('logs why the database was unreachable', async () => {
    await dead.check();

    expect(logged).toEqual([
      {
        event: 'health.probe_unreachable',
        component: 'postgres',
        error: expect.objectContaining({ code: 'ECONNREFUSED' }) as unknown,
      },
    ]);
  });

  it('logs nothing when the database answers', async () => {
    await live.check();

    expect(logged).toEqual([]);
  });

  it('stays reachable across repeated checks, so the pool is reusable', async () => {
    await expect(live.check()).resolves.toBe(true);
    await expect(live.check()).resolves.toBe(true);
  });
});
