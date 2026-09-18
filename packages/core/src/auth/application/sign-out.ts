import { ok, type DomainError, type Result } from '@repo/contracts';
import { type SessionTokenHash } from '../domain/session';
import { type SessionRepository } from '../ports/session-repository';

export type SignOutDependencies = {
  readonly sessions: SessionRepository;
  readonly hashSessionToken: (token: string) => SessionTokenHash;
};

export type SignOut = (token: string | undefined) => Promise<Result<void, DomainError>>;

/**
 * Ends the Session a cookie names, at once: the row is deleted, so the token
 * signs nobody in again, wherever it has been copied. Signing out with no
 * Session is already done.
 */
export function createSignOut({ sessions, hashSessionToken }: SignOutDependencies): SignOut {
  return async (token) => {
    if (token === undefined || token === '') {
      return ok(undefined);
    }
    return sessions.remove(hashSessionToken(token));
  };
}
