import { describe, expect, it, vi } from 'vitest';
import { classifyBalance } from './subject';

/**
 * VIOLATION: this test asserts on the mock, not on behaviour.
 *
 * It executes the subject, so line coverage looks fine, but it never checks what
 * the subject returned. Every mutant therefore survives. Coverage tools call
 * this a tested function; mutation testing calls it what it is.
 *
 * Expected gate: Stryker break threshold.
 */
describe('classifyBalance', () => {
  it('is invoked with the arguments it was given', () => {
    const spy = vi.fn(classifyBalance);

    spy(1000, 1000);

    expect(spy).toHaveBeenCalledWith(1000, 1000);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
