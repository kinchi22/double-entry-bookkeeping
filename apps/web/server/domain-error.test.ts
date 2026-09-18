import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_CODES, domainError, type DomainErrorCode } from '@repo/contracts';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { fromTrpcError, toTrpcError } from './domain-error';

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
  // Well-formed, and breaks a bookkeeping rule: 422 rather than 400.
  UNBALANCED: 'UNPROCESSABLE_CONTENT',
  // No Session: 401, which the specs pin. ADR-0021.
  UNAUTHENTICATED: 'UNAUTHORIZED',
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

/**
 * A router of its own, called in process the way a Server Action calls the
 * app's: the real one reaches the composition root, which no unit test can
 * import. What is asserted is the round trip `createCaller` actually performs.
 */
const t = initTRPC.create();
const caller = t.createCallerFactory(
  t.router({
    refuse: t.procedure.mutation(() => {
      throw toTrpcError(domainError('UNBALANCED', 'The debits and the credits differ.'));
    }),
    expectNumber: t.procedure.input(z.number()).query(({ input }) => input),
  }),
)({});

/** What a call threw, or a failed assertion if it returned. */
async function thrownBy(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (thrown) {
    return thrown;
  }
  expect.fail('the call was expected to throw');
}

describe('fromTrpcError', () => {
  it('recovers the domain failure a procedure threw, through createCaller', async () => {
    const thrown = await thrownBy(() => caller.refuse());

    expect(fromTrpcError(thrown)).toEqual({
      code: 'UNBALANCED',
      message: 'The debits and the credits differ.',
    });
  });

  it('recovers each code, including those that share a status', () => {
    for (const code of DOMAIN_ERROR_CODES) {
      expect(fromTrpcError(toTrpcError(domainError(code, 'why'))).code).toBe(code);
    }
  });

  it('rethrows a TRPCError no domain failure caused, such as a refused input', async () => {
    const thrown = await thrownBy(() => caller.expectNumber('twelve' as unknown as number));

    expect(thrown).toBeInstanceOf(TRPCError);
    expect(await thrownBy(() => Promise.resolve(fromTrpcError(thrown)))).toBe(thrown);
  });

  it('rethrows anything that is not a TRPCError, unchanged', async () => {
    const defect = new Error('DATABASE_URL is not set.');

    expect(await thrownBy(() => Promise.resolve(fromTrpcError(defect)))).toBe(defect);
  });
});
