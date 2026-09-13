import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, ok, type Result } from './result';

/**
 * The error model every other package returns, so a mutant here is a mutant
 * everywhere: an `ok` that reports `ok: false` turns every success into a
 * failure, and a predicate that answers `undefined` sends every caller down the
 * wrong branch.
 *
 * Stryker sandboxes the repository and symlinks `node_modules`, so a workspace
 * import of `@repo/contracts` resolves to the unmutated original. These mutants
 * are therefore reachable only from tests inside this package, which import by
 * relative path. See ADR-0004.
 */
describe('ok', () => {
  it('wraps the value and marks the result a success', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('keeps a falsy value, because absence and failure are different answers', () => {
    expect(ok(0)).toEqual({ ok: true, value: 0 });
    expect(ok(undefined)).toEqual({ ok: true, value: undefined });
  });
});

describe('err', () => {
  it('wraps the error and marks the result a failure', () => {
    expect(err('unreachable')).toEqual({ ok: false, error: 'unreachable' });
  });
});

describe('isOk', () => {
  it('accepts a success', () => {
    const result: Result<number, string> = ok(1);

    expect(isOk(result)).toBe(true);
  });

  it('rejects a failure', () => {
    const result: Result<number, string> = err('no');

    expect(isOk(result)).toBe(false);
  });
});

describe('isErr', () => {
  it('accepts a failure', () => {
    const result: Result<number, string> = err('no');

    expect(isErr(result)).toBe(true);
  });

  it('rejects a success', () => {
    const result: Result<number, string> = ok(1);

    expect(isErr(result)).toBe(false);
  });
});
