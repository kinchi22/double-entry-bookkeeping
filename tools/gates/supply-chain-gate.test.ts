import { describe, expect, it } from 'vitest';
import { REPO_ROOT, runGate } from './run-gate';

/**
 * Install-time security controls, asserted rather than commented.
 *
 * Every assertion goes through `pnpm config get` rather than reading the YAML:
 * what matters is the value pnpm resolves, not that a line exists in a file.
 *
 * The limit of that is worth stating, because it is exactly what went wrong
 * here once. `pnpm config get` echoes any key the file defines, including keys
 * pnpm itself no longer acts on -- so these prove the policy is well formed and
 * present, never that pnpm still reads it. Only an install proves that, and only
 * a cold one asks: an existing node_modules already records the answers in
 * .modules.yaml. CI is where a cold install runs.
 */
const MINIMUM_RELEASE_AGE_MINUTES = 10_080;

/** What pnpm resolves for a key. The literal 'undefined' when there is none. */
const configOf = (key: string): string => {
  const run = runGate('pnpm', ['config', 'get', key], REPO_ROOT);
  expect(run.status).toBe(0);
  return run.stdout.trim();
};

/**
 * `name@version`, anchored at both ends so a trailing anything cannot pass for
 * a version. The leading `@` is allowed for scoped packages, and a prerelease
 * or build suffix is a legitimate version.
 */
const VERSION_QUALIFIED = /^@?[^@]+@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/;

/**
 * Every way the build-script policy can be malformed.
 *
 * A pure function over the resolved map, so the deliberate breakages are the
 * inputs at the bottom of this file rather than a fixture directory. There is
 * nothing here for a path to resolve wrongly, which is the thing `fixtures/`
 * exists to catch.
 */
const policyProblems = (allowBuilds: Record<string, unknown>): readonly string[] => {
  const problems: string[] = [];

  // An empty map decides nothing while looking like a policy.
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
    // Greater-or-equal, so the policy can be tightened without editing this test
    // but never quietly loosened.
    expect(configured).toBeGreaterThanOrEqual(MINIMUM_RELEASE_AGE_MINUTES);
  });

  /**
   * Meeting a postinstall script with no decision recorded, pnpm appends a
   * scaffold to pnpm-workspace.yaml whose values are the literal string 'set
   * this to true or false'. Committing that reads as a policy and is not one:
   * the install keeps refusing, and it refuses in CI rather than locally.
   */
  it('records a real decision for every build script', () => {
    const raw = configOf('allowBuilds');
    expect(raw, 'pnpm-workspace.yaml has no allowBuilds map').not.toBe('undefined');

    expect(policyProblems(JSON.parse(raw) as Record<string, unknown>)).toEqual([]);
  });

  /**
   * `onlyBuiltDependencies` and `ignoredBuiltDependencies` are what pnpm 10
   * called this setting. pnpm 11 reads neither, so leaving them in place is a
   * policy that looks enforced and is not -- which is how three refused build
   * scripts came to be undecided.
   */
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

  /**
   * pnpm expands a range spec, so a range is not a version: it approves whatever
   * the resolver picks next, which is the trust inheritance the version
   * qualifier exists to stop.
   */
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
