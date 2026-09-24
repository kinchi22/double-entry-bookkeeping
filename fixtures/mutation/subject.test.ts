import { describe, expect, it, vi } from 'vitest';
import { classifyBalance } from './subject';

describe('classifyBalance', () => {
  it('is invoked with the arguments it was given', () => {
    const spy = vi.fn(classifyBalance);

    spy(1000, 1000);

    expect(spy).toHaveBeenCalledWith(1000, 1000);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
