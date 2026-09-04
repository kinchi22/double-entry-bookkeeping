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
});
