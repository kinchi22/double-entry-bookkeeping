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
