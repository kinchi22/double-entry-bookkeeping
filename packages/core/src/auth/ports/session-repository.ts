import { type DomainError, type Result } from '@repo/contracts';
import { type Session, type SessionTokenHash, type StoredSession } from '../domain/session';

export type SessionRepository = {
  readonly add: (session: Session) => Promise<Result<void, DomainError>>;
  readonly find: (
    tokenHash: SessionTokenHash,
  ) => Promise<Result<StoredSession | undefined, DomainError>>;
  readonly renew: (
    tokenHash: SessionTokenHash,
    expiresAt: Date,
  ) => Promise<Result<void, DomainError>>;
  readonly remove: (tokenHash: SessionTokenHash) => Promise<Result<void, DomainError>>;
};
