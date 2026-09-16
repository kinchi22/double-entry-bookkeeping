/**
 * Fails when the Drizzle schema has changed without a migration to match.
 *
 * `drizzle-kit generate` is the only thing that can answer "is there drift?",
 * because the answer is a diff against the snapshot in drizzle/meta. So the
 * check runs it for real and then puts the directory back exactly as it was.
 *
 * The restore works from an in-memory snapshot rather than from git, on purpose:
 * a developer part-way through writing a migration has uncommitted files in
 * there, and a `git checkout` would delete their work to answer a question.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

const { values } = parseArgs({
  options: { 'package-dir': { type: 'string', default: 'packages/db' } },
});

const packageDir = path.resolve(REPO_ROOT, values['package-dir']);
const migrationsDir = path.join(packageDir, 'drizzle');

/**
 * The real JS entrypoint rather than the .bin shim, matching how the db package
 * scripts invoke drizzle-kit. It is a devDependency of packages/db only, so it
 * is resolved from there even when the check runs against another directory.
 */
const DRIZZLE_KIT = path.join(
  REPO_ROOT,
  'packages',
  'db',
  'node_modules',
  'drizzle-kit',
  'bin.cjs',
);

if (!existsSync(DRIZZLE_KIT)) {
  console.error(`migration drift check could not run: drizzle-kit not found at ${DRIZZLE_KIT}.`);
  process.exit(1);
}

/** Every file under a directory, as path -> contents. Absent directory is an empty snapshot. */
const snapshot = (directory) => {
  const files = new Map();
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    files.set(path.relative(directory, absolute), readFileSync(absolute));
  }
  return files;
};

const restore = (directory, files) => {
  rmSync(directory, { recursive: true, force: true });
  for (const [relative, contents] of files) {
    const absolute = path.join(directory, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
};

const before = snapshot(migrationsDir);

const result = spawnSync(process.execPath, [DRIZZLE_KIT, 'generate'], {
  cwd: packageDir,
  encoding: 'utf8',
  shell: false,
  maxBuffer: 32 * 1024 * 1024,
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

/**
 * drizzle-kit reports failure in its output rather than in its exit status: a
 * schema it cannot compile, and a diff it wants to ask about but has no TTY for,
 * both exit 0 having written nothing. Exit status alone would read either as a
 * clean schema. So the run has to say which of the two things it did.
 */
const RAN = [/Your SQL migration file/, /No schema changes/];

if (result.status !== 0 || !RAN.some((marker) => marker.test(output))) {
  console.error('migration drift check could not run: drizzle-kit generate failed.');
  console.error(output.slice(-4000));
  process.exit(1);
}

const after = snapshot(migrationsDir);
const added = [...after.keys()].filter((file) => !before.has(file));
const changed = [...after.keys()].filter(
  (file) => before.has(file) && !before.get(file).equals(after.get(file)),
);
const removed = [...before.keys()].filter((file) => !after.has(file));

restore(migrationsDir, before);

if (added.length === 0 && changed.length === 0 && removed.length === 0) {
  console.log('no migration drift: the schema matches the migrations on disk.');
  process.exit(0);
}

console.error(
  'migration drift: packages/db/src/schema.ts has changed with no migration to match.\n' +
    'Run `pnpm --filter @repo/db db:generate`, review the generated SQL, and commit it\n' +
    'in the same PR as the schema change.\n',
);
for (const file of added) console.error(`  would add     drizzle/${file}`);
for (const file of changed) console.error(`  would change  drizzle/${file}`);
for (const file of removed) console.error(`  would remove  drizzle/${file}`);
process.exit(1);
