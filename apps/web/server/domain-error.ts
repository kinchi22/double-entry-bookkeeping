import { type DomainError, type DomainErrorCode } from '@repo/contracts';
import { TRPCError } from '@trpc/server';

/**
 * The single place where a domain failure becomes a transport failure, and
 * back.
 *
 * Core has no opinion about HTTP, so this mapping lives at the edge. The table
 * is exhaustive by type: adding a DomainErrorCode without deciding its status
 * fails typecheck.
 */
const STATUS_BY_CODE: Record<DomainErrorCode, TRPCError['code']> = {
  INVALID_INPUT: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DEPENDENCY_UNAVAILABLE: 'INTERNAL_SERVER_ERROR',
  UNBALANCED: 'UNPROCESSABLE_CONTENT',
  UNAUTHENTICATED: 'UNAUTHORIZED',
};

/**
 * The domain failure a TRPCError was made from, carried as its cause.
 *
 * A status is not enough to go back by: several codes can share one, and a
 * Server Action has to tell an imbalance from any other refusal to choose its
 * copy. tRPC keeps an `Error` cause as it is, and `createCaller` rethrows the
 * TRPCError it was given, so the value survives the round trip in process.
 */
class DomainFailure extends Error {
  readonly failure: DomainError;

  constructor(failure: DomainError) {
    super(failure.message);
    this.failure = failure;
  }
}

export function toTrpcError(error: DomainError): TRPCError {
  return new TRPCError({
    code: STATUS_BY_CODE[error.code],
    message: error.message,
    cause: new DomainFailure(error),
  });
}

/**
 * The domain failure behind something a procedure call threw.
 *
 * Anything else -- an input the router refused, a bug, an environment the app
 * cannot run in -- is rethrown unchanged. Those are not refusals a form can
 * explain, and swallowing them here would turn a defect into a message.
 */
export function fromTrpcError(thrown: unknown): DomainError {
  if (thrown instanceof TRPCError && thrown.cause instanceof DomainFailure) {
    return thrown.cause.failure;
  }
  throw thrown;
}
