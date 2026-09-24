import { describe, expect, it } from 'vitest';
import { REPO_ROOT, runGate } from './run-gate';

const MINIMUM_RELEASE_AGE_MINUTES = 10_080;

const configOf = (key: string): string => {
  const run = runGate('pnpm', ['config', 'get', key], REPO_ROOT);
  expect(run.status).toBe(0);
  return run.stdout.trim();
};

const VERSION_QUALIFIED = /^@?[^@]+@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/;

const policyProblems = (allowBuilds: Record<string, unknown>): readonly string[] => {
  const problems: string[] = [];

  if (Object.keys(allowBuilds).length === 0) problems.push('allowBuilds decides nothing');

  for (const [pkg, decision] of Object.entries(allowBuilds)) {
    if (typeof decision !== 'boolean') problems.push(`${pkg}: undecided`);
    if (!VERSION_QUALIFIED.test(pkg)) problems.push(`${pkg}: must name an exact version`);
  }

  return problems;
};

describe('supply-chain policy liveness', () => {
  it('holds new dependency versions for at least seven days', () => {
    const configured = Number.parseInt(configOf('minimumReleaseAge'), 10);

    expect(Number.isNaN(configured)).toBe(false);
    expect(configured).toBeGreaterThanOrEqual(MINIMUM_RELEASE_AGE_MINUTES);
  });

  it('records a real decision for every build script', () => {
    const raw = configOf('allowBuilds');
    expect(raw, 'pnpm-workspace.yaml has no allowBuilds map').not.toBe('undefined');

    expect(policyProblems(JSON.parse(raw) as Record<string, unknown>)).toEqual([]);
  });

  it('does not carry the settings pnpm stopped reading', () => {
    expect(configOf('onlyBuiltDependencies')).toBe('undefined');
    expect(configOf('ignoredBuiltDependencies')).toBe('undefined');
  });
});

describe('the build-script policy check', () => {
  it('passes a map that decides every entry against an exact version', () => {
    expect(policyProblems({ 'esbuild@0.28.2': true, 'ssh2@1.17.0': false })).toEqual([]);
  });

  it("rejects pnpm's scaffold, which is what shipped", () => {
    expect(policyProblems({ 'ssh2@1.17.0': 'set this to true or false' })).toContain(
      'ssh2@1.17.0: undecided',
    );
  });

  it('rejects a bare package name, which approves every future version', () => {
    expect(policyProblems({ esbuild: true })).toContain('esbuild: must name an exact version');
  });

  it('rejects a range, which approves versions nobody has seen', () => {
    expect(policyProblems({ 'esbuild@0.25.0 || ^1.0.0': true })).toContain(
      'esbuild@0.25.0 || ^1.0.0: must name an exact version',
    );
    expect(policyProblems({ 'esbuild@^0.25.0': true })).toContain(
      'esbuild@^0.25.0: must name an exact version',
    );
  });

  it('rejects a version that is only a prefix of the real one', () => {
    expect(policyProblems({ 'esbuild@0.28': true })).toContain(
      'esbuild@0.28: must name an exact version',
    );
  });

  it('accepts a scoped package and a prerelease version', () => {
    expect(policyProblems({ '@tailwindcss/oxide@4.3.3': true, 'sharp@0.35.3-rc.1': false })).toEqual(
      [],
    );
  });

  it('rejects an empty map', () => {
    expect(policyProblems({})).toContain('allowBuilds decides nothing');
  });
});
