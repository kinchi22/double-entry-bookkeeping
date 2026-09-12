/**
 * The single public surface of @repo/contracts.
 *
 * There are no other barrels in this package: an internal barrel would let a
 * layer import through it and launder a boundary violation past the linter.
 */
export type { Ok, Err, Result } from './result';
export { ok, err, isOk, isErr } from './result';

export type { DomainError, DomainErrorCode } from './errors';
export { DOMAIN_ERROR_CODES, domainError } from './errors';

export type { Brand } from './brand';

export type { Money } from './money';
export { moneySchema } from './money';

export { uuidV7Schema } from './id';

export type { HealthComponent, HealthState, HealthStatus } from './health';
export {
  healthComponentSchema,
  healthStateSchema,
  healthStatusSchema,
  toHealthStatus,
} from './health';
