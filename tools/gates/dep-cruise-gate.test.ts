import { describe, expect, it } from 'vitest';
import { DEP_CRUISE_FIXTURES } from './fixture-map';
import { bin, runGate, VIOLATIONS_DIR } from './run-gate';

describe('dependency-cruiser gate liveness', () => {
  const run = runGate(
    bin('depcruise'),
    ['packages', 'apps', '--config', '.dependency-cruiser.cjs'],
    VIOLATIONS_DIR,
  );

  it('exits non-zero on the violation fixtures', () => {
    expect(run.status).not.toBe(0);
  });

  it.each(DEP_CRUISE_FIXTURES)('%s is reported for %s', (ruleName, file) => {
    expect(run.stdout).toContain(ruleName);
    expect(run.stdout).toContain(file);
  });

  it('names both halves of the cycle', () => {
    expect(run.stdout).toContain('cycle-a.ts');
    expect(run.stdout).toContain('cycle-b.ts');
  });
});
