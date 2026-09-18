import { ok, type DomainError, type Result } from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../domain/auth-context';
import { assessSession, type SessionTokenHash } from '../domain/session';
import { type SessionRepository } from '../ports/session-repository';

export type ResolveSessionDependencies = {
  readonly sessions: SessionRepository;
  readonly hashSessionToken: (token: string) => SessionTokenHash;
  readonly now: () => Date;
};

/** The token is whatever the cookie held, if it held anything. */
export type ResolveSession = (
  token: string | undefined,
) => Promise<Result<AuthContext, DomainError>>;

/**
 * Who a request's session cookie signs in. A token the app never issued, and
 * a Session that has ended, are nobody: signed out, not a failure. Only a
 * Session store that cannot answer is one.
 *
 * A request in the second half of a Session's lifetime renews it.
 */
export function createResolveSession({
  sessions,
  hashSessionToken,
  now,
}: ResolveSessionDependencies): ResolveSession {
  return async (token) => {
    if (token === undefined || token === '') {
      return ok(SIGNED_OUT);
    }
    const tokenHash = hashSessionToken(token);
    const found = await sessions.find(tokenHash);
    if (!found.ok) {
      return found;
    }
    if (found.value === undefined) {
      return ok(SIGNED_OUT);
    }

    const state = assessSession(found.value, now());
    if (!state.active) {
      return ok(SIGNED_OUT);
    }
    if (state.renewTo !== undefined) {
      const renewed = await sessions.renew(tokenHash, state.renewTo);
      if (!renewed.ok) {
        return renewed;
      }
    }
    return ok({ userId: found.value.userId });
  };
}
