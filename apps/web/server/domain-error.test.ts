import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_CODES, domainError } from '@repo/contracts';
import { TRPCError } from '@trpc/server';
import { toTrpcError } from './domain-error';

/**
 * The first unit test under `apps/`, and the reason the unit glob was widened to
 * reach here in ADR-0003.
 *
 * The expected status for each code is written out as a literal rather than read
 * from the table under test: the mapping is the specification, so a test that
 * imported the table would agree with itself no matter what the table said.
 *
 * Nothing here mocks `TRPCError`. The assertions are about the error that came
 * back -- its code, its message, its type -- because the mutation threshold
 * rejects a test that only proves a call happened.
 */
describe('toTrpcError', () => {
  it('maps invalid input to BAD_REQUEST', () => {
    expect(toTrpcError(domainError('INVALID_INPUT', 'Amount must be a whole number.')).code).toBe(
      'BAD_REQUEST',
    );
  });

  it('maps a missing entity to NOT_FOUND', () => {
    expect(toTrpcError(domainError('NOT_FOUND', 'No such book.')).code).toBe('NOT_FOUND');
  });

  it('maps a conflicting write to CONFLICT', () => {
    expect(toTrpcError(domainError('CONFLICT', 'That period is closed.')).code).toBe('CONFLICT');
  });

  it('maps an unreachable dependency to INTERNAL_SERVER_ERROR, not to a client error', () => {
    expect(toTrpcError(domainError('DEPENDENCY_UNAVAILABLE', 'Postgres is unreachable.')).code).toBe(
      'INTERNAL_SERVER_ERROR',
    );
  });

  it('carries the domain message through unchanged', () => {
    const error = toTrpcError(domainError('CONFLICT', 'That period is closed.'));

    expect(error.message).toBe('That period is closed.');
  });

  it('returns a TRPCError, so the tRPC error formatter handles it', () => {
    expect(toTrpcError(domainError('NOT_FOUND', 'No such book.'))).toBeInstanceOf(TRPCError);
  });

  it('decides a status for every code in the vocabulary, leaving no hole in the table', () => {
    const statuses = DOMAIN_ERROR_CODES.map((code) => toTrpcError(domainError(code, 'why')).code);

    expect(statuses).toHaveLength(DOMAIN_ERROR_CODES.length);
    expect(statuses.filter((status) => typeof status === 'string' && status.length > 0)).toEqual(
      statuses,
    );
  });
});
