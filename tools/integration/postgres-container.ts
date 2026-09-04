import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * One throwaway Postgres for the whole integration run.
 *
 * The container is started here rather than reused from docker-compose because
 * a shared development database makes the gate conditional on a developer
 * having remembered `pnpm db:up`, and conditional gates are the failure mode
 * this repo exists to avoid. A test run either gets a real Postgres or fails.
 *
 * The image is pinned to the same tag docker-compose uses, so the integration
 * gate tests the database the product actually runs against.
 */
const IMAGE = 'postgres:17-alpine';

/**
 * The container URL is published as TEST_DATABASE_URL, deliberately not as
 * DATABASE_URL. An integration test that silently picked up a developer's real
 * connection string would truncate the wrong database, so the name is distinct
 * and nothing falls back to the ambient one.
 */
let container: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer(IMAGE).start();
  process.env['TEST_DATABASE_URL'] = container.getConnectionUri();
}

export async function teardown(): Promise<void> {
  await container?.stop();
  container = undefined;
  delete process.env['TEST_DATABASE_URL'];
}
