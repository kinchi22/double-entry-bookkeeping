import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findIsolationProblems, isIntegration, SPEC_ROOT } from '../check-pr-isolation';
import { REPO_ROOT } from './run-gate';

const onFeatureBranch = (...files: readonly string[]): readonly string[] =>
  findIsolationProblems({ head: 'add-ledger-entry', base: 'milestone/ledger', files });

describe('the isolation rule', () => {
  it('passes a pull request that only changes specs', () => {
    expect(onFeatureBranch('e2e/health.spec.ts', 'e2e/fixtures/user.ts')).toEqual([]);
  });

  it('passes a pull request that changes no spec', () => {
    expect(onFeatureBranch('apps/web/app/page.tsx', 'packages/core/src/health/index.ts')).toEqual(
      [],
    );
  });

  it('fails a pull request that changes a spec and the code it judges', () => {
    expect(onFeatureBranch('e2e/health.spec.ts', 'apps/web/app/page.tsx')).toEqual([
      'a pull request changes e2e/ or the rest of the repository, never both.',
      'The spec goes in its own pull request: onto the milestone branch, where it lands first, or onto main for a criterion the app already meets.',
      '  spec:  e2e/health.spec.ts',
      '  other: apps/web/app/page.tsx',
    ]);
  });

  it('names every file on both sides, in a stable order', () => {
    expect(
      onFeatureBranch('tools/b.ts', 'e2e/b.spec.ts', 'tools/a.ts', 'e2e/a.spec.ts').slice(2),
    ).toEqual([
      '  spec:  e2e/a.spec.ts',
      '  spec:  e2e/b.spec.ts',
      '  other: tools/a.ts',
      '  other: tools/b.ts',
    ]);
  });

  it('fails a spec moved out of the spec directory, which changes both sides', () => {
    expect(onFeatureBranch('e2e/health.spec.ts', 'tools/health.spec.ts')).not.toEqual([]);
  });

  it('counts a file once when a rename reports it twice', () => {
    expect(onFeatureBranch('e2e/health.spec.ts', 'e2e/health.spec.ts')).toEqual([]);
  });

  it('matches the directory, not the prefix of a name', () => {
    expect(onFeatureBranch('e2e-helpers/wait.ts', 'e2e.md', 'apps/web/app/page.tsx')).toEqual([]);
  });

  it('fails an empty list, because a pull request always changes something', () => {
    expect(onFeatureBranch()).toEqual([
      'no changed files were reported. A pull request changes at least one file, ' +
        'so this list is missing rather than empty.',
    ]);
  });

  it('names the directory it protects', () => {
    expect(SPEC_ROOT).toBe('e2e/');
  });
});

describe('the milestone exemption', () => {
  const both = ['e2e/health.spec.ts', 'apps/web/app/page.tsx'];

  it('lets a finished milestone carry its specs and its behaviour into the trunk', () => {
    expect(findIsolationProblems({ head: 'milestone/ledger', base: 'main', files: both })).toEqual(
      [],
    );
  });

  it('lets the trunk be merged back into a milestone that has fallen behind', () => {
    expect(findIsolationProblems({ head: 'main', base: 'milestone/ledger', files: both })).toEqual(
      [],
    );
  });

  it('still fails an integration pull request whose file list never arrived', () => {
    expect(
      findIsolationProblems({ head: 'milestone/ledger', base: 'main', files: [] }),
    ).not.toEqual([]);
  });

  it('does not exempt a feature branch aimed straight at the trunk', () => {
    expect(findIsolationProblems({ head: 'add-ledger-entry', base: 'main', files: both })).not.toEqual([]);
  });

  it('does not exempt one milestone merging into another', () => {
    expect(
      findIsolationProblems({ head: 'milestone/a', base: 'milestone/b', files: both }),
    ).not.toEqual([]);
  });

  it('reads the milestone prefix strictly, so a near miss is still checked', () => {
    expect(isIntegration({ head: 'milestone/Ledger', base: 'main' })).toBe(false);
    expect(isIntegration({ head: 'milestones/ledger', base: 'main' })).toBe(false);
    expect(isIntegration({ head: 'milestone/', base: 'main' })).toBe(false);
    expect(isIntegration({ head: 'milestone/-ledger', base: 'main' })).toBe(false);
    expect(isIntegration({ head: 'milestone/ledger', base: 'main' })).toBe(true);
  });
});

const run = (
  input: string,
  ...args: readonly string[]
): { status: number; stdout: string; stderr: string } => {
  const result = spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, 'tools', 'check-pr-isolation.ts'), ...args],
    { cwd: REPO_ROOT, encoding: 'utf8', input, shell: false },
  );
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
};

describe('the isolation gate as CI runs it', () => {
  it('exits non-zero and says which files broke the rule', () => {
    const result = run(
      'e2e/health.spec.ts\napps/web/app/page.tsx\n',
      'add-ledger-entry',
      'milestone/ledger',
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('  spec:  e2e/health.spec.ts');
    expect(result.stderr).toContain('  other: apps/web/app/page.tsx');
  });

  it('exits zero for a pull request that stays on one side', () => {
    expect(run('e2e/health.spec.ts\n', 'write-the-spec', 'milestone/ledger').status).toBe(0);
  });

  it('says why it passed an integration pull request, rather than passing silently', () => {
    const result = run('e2e/health.spec.ts\napps/web/app/page.tsx\n', 'milestone/ledger', 'main');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('milestone meeting the trunk');
  });

  it('exits non-zero when the file list never arrives', () => {
    expect(run('', 'add-ledger-entry', 'milestone/ledger').status).toBe(1);
  });

  it('exits non-zero when the branch names never arrive', () => {
    expect(run('e2e/health.spec.ts\napps/web/app/page.tsx\n').status).toBe(1);
  });
});
