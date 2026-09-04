import { type DomainError, type DomainErrorCode } from '@repo/contracts';
import { TRPCError } from '@trpc/server';

/**
 * The single place where a domain failure becomes a transport failure.
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
};

export function toTrpcError(error: DomainError): TRPCError {
  return new TRPCError({
    code: STATUS_BY_CODE[error.code],
    message: error.message,
  });
}
