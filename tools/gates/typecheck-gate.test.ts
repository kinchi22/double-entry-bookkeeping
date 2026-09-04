import { describe, expect, it } from 'vitest';
import { bin, runGate, VIOLATIONS_DIR } from './run-gate';

describe('typecheck gate liveness', () => {
  it('rejects a deep import that reaches past a package public surface', () => {
    const run = runGate(bin('tsc'), ['-p', 'tsconfig.json', '--noEmit'], VIOLATIONS_DIR);

    expect(run.status, 'tsc must exit non-zero').not.toBe(0);
    // Asserted precisely rather than on the exit code alone: a deep import must
    // fail because the `exports` field does not list it, not for some unrelated
    // type error that happens to be in the same fixture tree.
    expect(run.stdout).toContain('apps/web/server/deep-import.ts');
    expect(run.stdout).toContain('TS2307');
    expect(run.stdout).toContain('@repo/core/src/health/domain/status');
  });
});
