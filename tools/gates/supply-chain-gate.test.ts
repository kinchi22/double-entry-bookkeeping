import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, runGate } from './run-gate';

/**
 * The seven-day cooling-off period on dependency installs is a security control,
 * so it is asserted rather than commented.
 *
 * The assertion goes through `pnpm config get` instead of reading the YAML: what
 * matters is that pnpm actually applies the setting, not that a line exists in a
 * file. A key that gets renamed in a future pnpm release would leave the file
 * looking correct and the policy switched off.
 */
const MINIMUM_RELEASE_AGE_MINUTES = 10_080;

/**
 * Read a setting back through pnpm, as JSON.
 *
 * Reading the YAML directly would only prove a line exists in a file. This is
 * still weaker than it looks -- `pnpm config get` echoes any key the file
 * defines, including ones pnpm no longer acts on -- so what it catches is a
 * malformed or undecided policy, not a renamed one. The install itself is what
 * catches a renamed one, and CI is where the install runs from scratch.
 */
const configJson = (key: string): unknown => {
  const run = runGate('pnpm', ['config', 'get', key], REPO_ROOT);
  expect(run.status).toBe(0);
  return JSON.parse(run.stdout.trim()) as unknown;
};

/** `name@version`, with the scoped-package leading `@` allowed. */
const VERSION_QUALIFIED = /^@?[^@]+@\d+\.\d+\.\d+/;

describe('supply-chain policy liveness', () => {
  it('holds new dependency versions for at least seven days', () => {
    const run = runGate('pnpm', ['config', 'get', 'minimumReleaseAge'], REPO_ROOT);

    expect(run.status).toBe(0);
    const configured = Number.parseInt(run.stdout.trim(), 10);
    expect(Number.isNaN(configured)).toBe(false);
    // Greater-or-equal, so the policy can be tightened without editing this test
    // but never quietly loosened.
    expect(configured).toBeGreaterThanOrEqual(MINIMUM_RELEASE_AGE_MINUTES);
  });

  /**
   * When pnpm meets a postinstall script with no decision recorded, it appends a
   * scaffold to pnpm-workspace.yaml whose values are the literal string 'set
   * this to true or false'. Committing that reads as a policy and is not one:
   * the install keeps failing, and it fails in CI rather than locally, because
   * an existing node_modules already carries the answers.
   */
  it('records a real decision for every build script', () => {
    const allowBuilds = configJson('allowBuilds');

    expect(typeof allowBuilds).toBe('object');
    expect(allowBuilds).not.toBeNull();

    for (const [pkg, decision] of Object.entries(allowBuilds as Record<string, unknown>)) {
      expect(typeof decision, `allowBuilds entry '${pkg}' is undecided`).toBe('boolean');
      expect(pkg, `allowBuilds entry '${pkg}' must name a version`).toMatch(VERSION_QUALIFIED);
    }
  });

  /**
   * `onlyBuiltDependencies` and `ignoredBuiltDependencies` are what pnpm 10
   * called this setting. pnpm 11 reads neither, so leaving them in place is a
   * policy that looks enforced and is not -- which is how three refused build
   * scripts ended up undecided.
   */
  it('does not carry the settings pnpm stopped reading', () => {
    const workspace = readFileSync(path.join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8');

    expect(workspace).not.toMatch(/^onlyBuiltDependencies:/m);
    expect(workspace).not.toMatch(/^ignoredBuiltDependencies:/m);
  });
});
