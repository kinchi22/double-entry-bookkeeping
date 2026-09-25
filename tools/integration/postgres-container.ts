import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const IMAGE = 'postgres:18-alpine';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const DB_PACKAGE = path.join(REPO_ROOT, 'packages', 'db');
const DRIZZLE_KIT = path.join(DB_PACKAGE, 'node_modules', 'drizzle-kit', 'bin.cjs');

let container: StartedPostgreSqlContainer | undefined;

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
