import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  decide,
  lastAppliedSha,
  MIGRATIONS_ROOT,
  type Deployment,
} from '../find-pending-migrations';
import { REPO_ROOT } from './run-gate';

const SHA_APPLIED = 'a'.repeat(40);
const SHA_OLDER = 'b'.repeat(40);

const deployment = (sha: string, state: string): Deployment => ({ sha, state });

describe('lastAppliedSha', () => {
  it('takes the newest deployment that succeeded', () => {
    expect(
      lastAppliedSha([deployment(SHA_APPLIED, 'success'), deployment(SHA_OLDER, 'success')]),
    ).toBe(SHA_APPLIED);
  });

  it('passes over runs that were cancelled, rejected or are still waiting', () => {
    expect(
      lastAppliedSha([
        deployment('c'.repeat(40), 'waiting'),
        deployment('d'.repeat(40), 'error'),
        deployment('e'.repeat(40), 'failure'),
        deployment(SHA_APPLIED, 'success'),
      ]),
    ).toBe(SHA_APPLIED);
  });

  it('finds nothing when no deployment succeeded', () => {
    expect(lastAppliedSha([deployment(SHA_OLDER, 'error')])).toBeUndefined();
    expect(lastAppliedSha([])).toBeUndefined();
  });

  it('stops reading at the first success', () => {
    const read: string[] = [];
    function* deployments(): Generator<Deployment> {
      for (const sha of [SHA_APPLIED, SHA_OLDER]) {
        read.push(sha);
        yield deployment(sha, 'success');
      }
    }

    lastAppliedSha(deployments());

    expect(read).toEqual([SHA_APPLIED]);
  });
});

describe('decide', () => {
  it('skips when nothing under the migrations folder changed', () => {
    expect(decide(SHA_APPLIED, ['apps/web/app/page.tsx', 'packages/db/src/schema.ts'])).toEqual({
      pending: false,
      reason: `Nothing under ${MIGRATIONS_ROOT} changed since ${SHA_APPLIED}, the last commit Production was migrated at.`,
    });
    expect(decide(SHA_APPLIED, []).pending).toBe(false);
  });

  it('asks when a migration or its journal changed, and names the files', () => {
    const verdict = decide(SHA_APPLIED, [
      'apps/web/app/page.tsx',
      'packages/db/drizzle/0001_accounts.sql',
      'packages/db/drizzle/meta/_journal.json',
    ]);

    expect(verdict).toEqual({
      pending: true,
      reason: [
        `2 file(s) under ${MIGRATIONS_ROOT} changed since ${SHA_APPLIED}:`,
        '  packages/db/drizzle/0001_accounts.sql',
        '  packages/db/drizzle/meta/_journal.json',
      ].join('\n'),
    });
  });

  it('does not mistake a path that only starts like the folder', () => {
    expect(decide(SHA_APPLIED, ['packages/db/drizzle.config.ts']).pending).toBe(false);
  });

  it('asks when no migration was ever applied', () => {
    expect(decide(undefined, [])).toEqual({
      pending: true,
      reason: 'No successful production-database deployment was found, so a migration may be pending.',
    });
  });

  it('asks when the applied commit could not be compared', () => {
    expect(decide(SHA_APPLIED, undefined)).toEqual({
      pending: true,
      reason: `${SHA_APPLIED} could not be compared with this commit, so a migration may be pending.`,
    });
  });
});

describe('find-pending-migrations.ts, run as CI runs it', () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'pending-migrations-'));
  const repository = path.join(sandbox, 'repo');
  const stubBin = path.join(sandbox, 'bin');
  let beforeMigration = '';
  let afterMigration = '';

  const git = (...args: string[]): string => {
    const result = spawnSync(
      'git',
      ['-c', 'user.name=gate', '-c', 'user.email=gate@example.invalid', ...args],
      { cwd: repository, encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  };

  beforeAll(() => {
    mkdirSync(path.join(repository, 'packages/db/drizzle'), { recursive: true });
    git('init', '--quiet');
    writeFileSync(path.join(repository, 'README.md'), 'before\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'before');
    beforeMigration = git('rev-parse', 'HEAD');
    writeFileSync(path.join(repository, 'packages/db/drizzle/0001_accounts.sql'), 'select 1;\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'migration');
    afterMigration = git('rev-parse', 'HEAD');

    mkdirSync(stubBin);
    writeFileSync(
      path.join(stubBin, 'gh'),
      [
        '#!/usr/bin/env node',
        'if (process.env.STUB_FAIL) { process.exit(1); }',
        "const rows = (process.env.STUB_DEPLOYMENTS ?? '').split('\\n').filter(Boolean).map((line) => line.split(' '));",
        'const url = process.argv[3];',
        'const status = /deployments\\/(\\d+)\\/statuses/.exec(url);',
        'if (status) {',
        "  console.log((rows.find(([id]) => id === status[1]) ?? [])[2] ?? '');",
        "} else if (url.includes('deployments?environment=production-database')) {",
        '  for (const [id, sha] of rows) console.log(id + " " + sha);',
        '} else { process.exit(1); }',
        '',
      ].join('\n'),
    );
    chmodSync(path.join(stubBin, 'gh'), 0o755);
  });

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  let runs = 0;
  const runCommand = (
    env: Record<string, string>,
  ): { status: number; stdout: string; output: string } => {
    runs += 1;
    const output = path.join(sandbox, `output-${String(runs)}`);
    writeFileSync(output, '');
    const result = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'tools', 'find-pending-migrations.ts')],
      {
        cwd: repository,
        encoding: 'utf8',
        env: {
          PATH: `${stubBin}${path.delimiter}${process.env['PATH'] ?? ''}`,
          GITHUB_REPOSITORY: 'owner/repo',
          GITHUB_OUTPUT: output,
          ...env,
        },
      },
    );
    return { status: result.status ?? -1, stdout: result.stdout, output: readFileSync(output, 'utf8') };
  };

  it('writes pending=false when Production was migrated at this commit', () => {
    const result = runCommand({
      STUB_DEPLOYMENTS: `2 ${'f'.repeat(40)} error\n1 ${afterMigration} success`,
    });

    expect(result.status).toBe(0);
    expect(result.output).toBe('pending=false\n');
  });

  it('writes pending=true when a migration landed after the applied commit', () => {
    const result = runCommand({ STUB_DEPLOYMENTS: `1 ${beforeMigration} success` });

    expect(result.status).toBe(0);
    expect(result.output).toBe('pending=true\n');
    expect(result.stdout).toContain('packages/db/drizzle/0001_accounts.sql');
  });

  it('writes pending=true when the applied commit is not in the history', () => {
    const result = runCommand({ STUB_DEPLOYMENTS: `1 ${'0'.repeat(40)} success` });

    expect(result.output).toBe('pending=true\n');
    expect(result.stdout).toContain('could not be compared');
  });

  it('writes pending=true, and warns, when the deployments cannot be read', () => {
    const result = runCommand({ STUB_FAIL: '1' });

    expect(result.status).toBe(0);
    expect(result.output).toBe('pending=true\n');
    expect(result.stdout).toContain('::warning::');
  });
});
