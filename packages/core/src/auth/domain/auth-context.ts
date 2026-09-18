import {
  domainError,
  err,
  ok,
  type DomainError,
  type Result,
  type UserId,
} from '@repo/contracts';

/**
 * Who a request is made by: the User its Session belongs to, or nobody.
 *
 * A controller resolves it from the request and passes it on; a use case that
 * touches a User's data checks it at its entry point, with `requireUser`. That
 * check is the rule. A page sending a signed-out visitor to sign in is a
 * courtesy on top of it. ADR-0021.
 */
export type AuthContext = {
  readonly userId: UserId | undefined;
};

export const SIGNED_OUT: AuthContext = { userId: undefined };

export function requireUser(auth: AuthContext): Result<UserId, DomainError> {
  return auth.userId === undefined
    ? err(domainError('UNAUTHENTICATED', 'This needs a signed-in User.'))
    : ok(auth.userId);
}
