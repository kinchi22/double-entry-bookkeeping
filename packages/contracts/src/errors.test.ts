import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_CODES, domainError } from './errors';

/**
 * A domain failure is a value, and its code is what a router turns into an HTTP
 * status. The message is for a human reading a log, so nothing asserts on its
 * text anywhere else in the repository -- it is asserted here, once, that it
 * arrives at all.
 */
describe('domainError', () => {
  it('carries the code and the message it was given', () => {
    expect(domainError('CONFLICT', 'That period is closed.')).toEqual({
      code: 'CONFLICT',
      message: 'That period is closed.',
    });
  });
});

describe('DOMAIN_ERROR_CODES', () => {
  it('enumerates each code exactly once, because exhaustiveness elsewhere is read off it', () => {
    expect(new Set(DOMAIN_ERROR_CODES).size).toBe(DOMAIN_ERROR_CODES.length);
  });
});
