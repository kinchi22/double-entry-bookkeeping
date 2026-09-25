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
  if (!/migration drift/i.test(output)) {
    fail(`the drift check failed for an unrelated reason. Output:\n${output.slice(-4000)}`);
  }

  console.log('migration gate is alive: the drift check rejected the unmigrated schema.');
} finally {
  writeFileSync(SCHEMA, original);
}
