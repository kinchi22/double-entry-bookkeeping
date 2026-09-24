import { type DomainError, type DomainErrorCode } from '@repo/contracts';
import { TRPCError } from '@trpc/server';

const STATUS_BY_CODE: Record<DomainErrorCode, TRPCError['code']> = {
  INVALID_INPUT: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DEPENDENCY_UNAVAILABLE: 'INTERNAL_SERVER_ERROR',
  UNBALANCED: 'UNPROCESSABLE_CONTENT',
  UNAUTHENTICATED: 'UNAUTHORIZED',
};

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

export function fromTrpcError(thrown: unknown): DomainError {
  if (thrown instanceof TRPCError && thrown.cause instanceof DomainFailure) {
    return thrown.cause.failure;
  }
  throw thrown;
}
