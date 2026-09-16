/**
 * Section 9: proves the migration drift gate actually blocks a schema change
 * that arrives without a migration.
 *
 * The fixture has to be planted inside packages/db rather than checked from
 * where it lives, because drizzle-kit compiles the schema in place and resolves
 * drizzle-orm from it. Restoring the original is in a finally block: leaving
 * the fixture behind would rewrite the real schema.
 *
 * It is appended to the schema rather than written over it, so the planted
 * change is one table added to whatever the schema already holds. Substituting
 * the file also drops every real table, and drizzle-kit answers a create beside
 * a drop by asking whether the table was renamed, which it cannot do with no
 * TTY: it fails and writes nothing, and the drift check reads that as no drift.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURE = path.join(REPO_ROOT, 'fixtures', 'migration', 'schema-with-a-table.ts');
const SCHEMA = path.join(REPO_ROOT, 'packages', 'db', 'src', 'schema.ts');
const DRIFT_CHECK = path.join(REPO_ROOT, 'tools', 'check-migration-drift.mjs');

const fail = (message) => {
  console.error(`migration gate is NOT alive: ${message}`);
  process.exit(1);
};

const original = readFileSync(SCHEMA);

try {
  writeFileSync(SCHEMA, `${original.toString()}\n${readFileSync(FIXTURE, 'utf8')}`);

  const result = spawnSync(process.execPath, [DRIFT_CHECK], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 32 * 1024 * 1024,
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.status === 0) {
    fail('the drift check accepted a new table with no migration.');
  }
  // Assert on the reason. The check also exits non-zero when drizzle-kit itself
  // fails to run, which would otherwise look like a working gate.
  if (!/migration drift/i.test(output)) {
    fail(`the drift check failed for an unrelated reason. Output:\n${output.slice(-4000)}`);
  }

  console.log('migration gate is alive: the drift check rejected the unmigrated schema.');
} finally {
  writeFileSync(SCHEMA, original);
}
