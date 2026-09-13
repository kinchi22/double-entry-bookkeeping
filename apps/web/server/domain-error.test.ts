import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_CODES, domainError, type DomainErrorCode } from '@repo/contracts';
import { TRPCError } from '@trpc/server';
import { toTrpcError } from './domain-error';

/**
 * The first unit test under `apps/`, and what proves ADR-0003's widened include
 * reaches here.
 *
 * The expected status for each code is written out rather than read from the
 * table under test: the mapping is the specification, so a test that imported
 * the table would agree with it whatever it said. Typing the expectation as
 * `Record<DomainErrorCode, ...>` is what makes it exhaustive -- a new code fails
 * to compile here as well as in the subject -- and comparing the whole map in one
 * assertion is what makes a wrong entry fail rather than an untested one pass.
 */
const EXPECTED_STATUS: Record<DomainErrorCode, TRPCError['code']> = {
  INVALID_INPUT: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  // A dependency this app could not reach is this app's failure rather than the
  // caller's, so it is the one code that must not come back as a 4xx.
  DEPENDENCY_UNAVAILABLE: 'INTERNAL_SERVER_ERROR',
};

describe('toTrpcError', () => {
  it('maps every code in the vocabulary onto the status decided for it', () => {
    const mapped = Object.fromEntries(
      DOMAIN_ERROR_CODES.map((code) => [code, toTrpcError(domainError(code, 'why')).code] as const),
    );

    expect(mapped).toEqual(EXPECTED_STATUS);
  });

  it('carries the domain message through unchanged', () => {
    const error = toTrpcError(domainError('CONFLICT', 'That period is closed.'));

    expect(error.message).toBe('That period is closed.');
  });

  it('returns a TRPCError, so the tRPC error formatter handles it', () => {
    expect(toTrpcError(domainError('NOT_FOUND', 'No such book.'))).toBeInstanceOf(TRPCError);
  });
});
