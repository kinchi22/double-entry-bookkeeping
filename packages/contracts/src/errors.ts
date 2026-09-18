/**
 * Domain failures are values with a stable, enumerable code.
 *
 * The code is what a router maps onto an HTTP status. Message text is for
 * humans reading logs, never for branching on.
 *
 * `UNBALANCED` is the one broken rule with a code of its own: an entry whose
 * debits and credits differ (ADR-0010). The entry form has to say that the
 * balance is what is wrong, and branching on a message is what this vocabulary
 * exists to prevent. Every other rule an entry breaks is `INVALID_INPUT`.
 *
 * `UNAUTHENTICATED` is a call that needs a signed-in User and was made without
 * a Session (ADR-0021). A row another User owns is `NOT_FOUND`, never a code of
 * its own, so an id reveals nothing about whether it exists.
 */
export const DOMAIN_ERROR_CODES = [
  'INVALID_INPUT',
  'NOT_FOUND',
  'CONFLICT',
  'DEPENDENCY_UNAVAILABLE',
  'UNBALANCED',
  'UNAUTHENTICATED',
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
