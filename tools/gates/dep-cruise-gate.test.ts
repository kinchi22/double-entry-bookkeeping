import { describe, expect, it } from 'vitest';
import { DEP_CRUISE_FIXTURES } from './fixture-map';
import { bin, runGate, VIOLATIONS_DIR } from './run-gate';

/**
 * dependency-cruiser reasons about the resolved module graph rather than about
 * import statements, so it is the tool that catches cycles and reaches the
 * linter's per-file view cannot see. Each forbidden rule in the shipped preset
 * gets a fixture here; rule-coverage-gate.test.ts is what makes sure none is
 * missing from the list.
 */
describe('dependency-cruiser gate liveness', () => {
  const run = runGate(
    bin('depcruise'),
    ['packages', 'apps', '--config', '.dependency-cruiser.cjs'],
    VIOLATIONS_DIR,
  );

  it('exits non-zero on the violation fixtures', () => {
    expect(run.status).not.toBe(0);
  });

  // Asserted per rule and per path rather than on the exit code alone: one
  // broken fixture must not be covered for by another rule still firing.
  it.each(DEP_CRUISE_FIXTURES)('%s is reported for %s', (ruleName, file) => {
    expect(run.stdout).toContain(ruleName);
    expect(run.stdout).toContain(file);
  });

  it('names both halves of the cycle', () => {
    expect(run.stdout).toContain('cycle-a.ts');
    expect(run.stdout).toContain('cycle-b.ts');
  });
});
