import { afterAll, describe, expect, it } from 'vitest';
import { createPostgresHealthProbe } from './postgres-health-probe';

/**
 * Integration test: the adapter runs against a real Postgres, never a mock.
 *
 * A mocked pg client would prove that this file calls the methods it calls,
 * which is a restatement of the source rather than a test of it. The behaviour
 * worth asserting -- that a live database answers, and that an absent one
 * becomes `false` instead of an exception -- only exists when there is a real
 * server on the other end.
 *
 * The connection string comes from the container started in
 * tools/integration/postgres-container.ts.
 */
const databaseUrl = process.env['TEST_DATABASE_URL'];
if (databaseUrl === undefined) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Run integration tests with `pnpm test:integration`, ' +
      'which starts the Postgres container this suite needs.',
  );
}

/** Port 1 is reserved and nothing binds it, so the connection is refused immediately. */
const UNREACHABLE_URL = 'postgresql://absent:absent@127.0.0.1:1/absent';

const live = createPostgresHealthProbe(databaseUrl);
const dead = createPostgresHealthProbe(UNREACHABLE_URL);

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

  it('stays reachable across repeated checks, so the pool is reusable', async () => {
    await expect(live.check()).resolves.toBe(true);
    await expect(live.check()).resolves.toBe(true);
  });
});
