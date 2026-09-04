import { spawnSync } from 'node:child_process';
import path from 'node:path';
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
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const DB_PACKAGE = path.join(REPO_ROOT, 'packages', 'db');
const DRIZZLE_KIT = path.join(DB_PACKAGE, 'node_modules', 'drizzle-kit', 'bin.cjs');

let container: StartedPostgreSqlContainer | undefined;

/**
 * Applies the committed migrations with the same command a deployment runs.
 *
 * Calling drizzle-kit rather than reproducing what it does is the point: every
 * integration run then exercises the real migration path, so a migration that
 * cannot be applied fails here instead of during a deploy. DATABASE_URL is set
 * only for this child process, so nothing else can see the container.
 */
function migrate(databaseUrl: string): void {
  const result = spawnSync(process.execPath, [DRIZZLE_KIT, 'migrate'], {
    cwd: DB_PACKAGE,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  if (result.status !== 0) {
    throw new Error(
      `Applying migrations to the test container failed.\n${result.stdout}\n${result.stderr}`,
    );
  }
}

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer(IMAGE).start();
  const databaseUrl = container.getConnectionUri();
  migrate(databaseUrl);
  process.env['TEST_DATABASE_URL'] = databaseUrl;
}

export async function teardown(): Promise<void> {
  await container?.stop();
  container = undefined;
  delete process.env['TEST_DATABASE_URL'];
}
