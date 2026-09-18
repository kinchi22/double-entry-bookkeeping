import { type DomainError, type Result } from '@repo/contracts';
import { type Session, type SessionTokenHash, type StoredSession } from '../domain/session';

/**
 * Where Sessions are kept, by the hash of their token.
 *
 * Two implementations exist: the Postgres adapter and the in-memory stub the
 * use case tests run against.
 */
export type SessionRepository = {
  readonly add: (session: Session) => Promise<Result<void, DomainError>>;
  /**
   * The Session a hash names, or `undefined`. It does not slide when its User
   * has no Identity, which is what makes that User the Smoke User.
   */
  readonly find: (
    tokenHash: SessionTokenHash,
  ) => Promise<Result<StoredSession | undefined, DomainError>>;
  readonly renew: (
    tokenHash: SessionTokenHash,
    expiresAt: Date,
  ) => Promise<Result<void, DomainError>>;
  /** Ends a Session at once. Removing one that does not exist is not a failure. */
  readonly remove: (tokenHash: SessionTokenHash) => Promise<Result<void, DomainError>>;
};
