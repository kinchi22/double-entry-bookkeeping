/**
 * Domain failures are values with a stable, enumerable code.
 *
 * The code is what a router maps onto an HTTP status. Message text is for
 * humans reading logs, never for branching on.
 */
export const DOMAIN_ERROR_CODES = [
  'INVALID_INPUT',
  'NOT_FOUND',
  'CONFLICT',
  'DEPENDENCY_UNAVAILABLE',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export type DomainError = {
  readonly code: DomainErrorCode;
  readonly message: string;
};

export const domainError = (code: DomainErrorCode, message: string): DomainError => ({
  code,
  message,
});
