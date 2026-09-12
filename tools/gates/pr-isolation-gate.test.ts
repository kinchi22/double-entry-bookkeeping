import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findIsolationProblems, SPEC_ROOT } from '../check-pr-isolation';
import { REPO_ROOT } from './run-gate';

/**
 * Section 9, applied to the isolation rule of ADR-0002.
 *
 * The rule is a function over a list of paths, so the deliberate breakages are
 * inputs here rather than a fixture tree: nothing in it resolves a path, which
 * is what `fixtures/` exists to keep honest elsewhere.
 *
 * The last block runs the file as a command. CI depends on a non-zero exit and
 * on Node running a `.ts` file with no build step, and neither is visible to a
 * test that only calls the function.
 */

const violation = (...files: readonly string[]): readonly string[] =>
  findIsolationProblems(files);

describe('the isolation rule', () => {
  it('passes a pull request that only changes specs', () => {
    expect(violation('e2e/health.spec.ts', 'e2e/fixtures/user.ts')).toEqual([]);
  });

  it('passes a pull request that changes no spec', () => {
    expect(violation('apps/web/app/page.tsx', 'packages/core/src/health/index.ts')).toEqual([]);
  });

  it('fails a pull request that changes a spec and the code it judges', () => {
    expect(violation('e2e/health.spec.ts', 'apps/web/app/page.tsx')).toEqual([
      'a pull request changes e2e/ or the rest of the repository, never both. ' +
        'Split it into two, spec last.',
      '  spec:  e2e/health.spec.ts',
      '  other: apps/web/app/page.tsx',
    ]);
  });

  it('names every file on both sides, in a stable order', () => {
    expect(violation('tools/b.ts', 'e2e/b.spec.ts', 'tools/a.ts', 'e2e/a.spec.ts').slice(1)).toEqual([
      '  spec:  e2e/a.spec.ts',
      '  spec:  e2e/b.spec.ts',
      '  other: tools/a.ts',
      '  other: tools/b.ts',
    ]);
  });

  it('fails a spec moved out of the spec directory, which changes both sides', () => {
    // A rename reaches the check as its old path and its new one.
    expect(violation('e2e/health.spec.ts', 'tools/health.spec.ts')).not.toEqual([]);
  });

  it('counts a file once when a rename reports it twice', () => {
    expect(violation('e2e/health.spec.ts', 'e2e/health.spec.ts')).toEqual([]);
  });

  it('matches the directory, not the prefix of a name', () => {
    expect(violation('e2e-helpers/wait.ts', 'e2e.md', 'apps/web/app/page.tsx')).toEqual([]);
  });

  it('fails an empty list, because a pull request always changes something', () => {
    expect(violation()).toEqual([
      'no changed files were reported. A pull request changes at least one file, ' +
        'so this list is missing rather than empty.',
    ]);
  });

  it('names the directory it protects', () => {
    expect(SPEC_ROOT).toBe('e2e/');
  });
});

const run = (input: string): { status: number; stdout: string; stderr: string } => {
  const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'check-pr-isolation.ts')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input,
    shell: false,
  });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
};

describe('the isolation gate as CI runs it', () => {
  it('exits non-zero and says which files broke the rule', () => {
    const result = run('e2e/health.spec.ts\napps/web/app/page.tsx\n');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('  spec:  e2e/health.spec.ts');
    expect(result.stderr).toContain('  other: apps/web/app/page.tsx');
  });

  it('exits zero for a pull request that stays on one side', () => {
    const result = run('e2e/health.spec.ts\n');
    expect(result.status).toBe(0);
  });

  it('exits non-zero when the file list never arrives', () => {
    const result = run('');
    expect(result.status).toBe(1);
  });
});
