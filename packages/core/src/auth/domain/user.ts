import {
  domainError,
  err,
  ok,
  type DomainError,
  type Err,
  type Result,
  type UserId,
} from '@repo/contracts';

/**
 * A User, and the Identities a User signs in by. ADR-0021.
 *
 * A User is found by an Identity, never by an email: an email can change hands,
 * and Google's `sub` cannot. The email and the name are what the provider said at
 * the latest sign-in, kept for display and nothing else.
 */

export type User = {
  readonly id: UserId;
  readonly email: string;
  /** Google does not promise one, and the test sign-in has none. */
  readonly name: string | null;
  readonly createdAt: Date;
};

/**
 * Google is the only provider a person can choose. `test` is the test sign-in,
 * which exists only where `AUTH_TEST_LOGIN` is set, and never on Production.
 */
export type IdentityProvider = 'google' | 'test';

/** One way a User signs in: a provider, and that provider's subject for them. */
export type Identity = {
  readonly provider: IdentityProvider;
  readonly subject: string;
};

/** What a provider says about the person at sign-in. */
export type Profile = {
  readonly email: string;
  readonly name: string | null;
};

/** A person as one sign-in presents them: who they are, and what they are called. */
export type SignInClaims = {
  readonly identity: Identity;
  readonly profile: Profile;
};

/** What Google's ID token said, before any rule has been applied to it. */
export type GoogleClaims = {
  readonly sub: string;
  readonly email: string | undefined;
  readonly name: string | undefined;
};

const invalid = (message: string): Err<DomainError> =>
  err(domainError('INVALID_INPUT', message));

/**
 * A Google sign-in, as this app keeps it. Without a subject there is nobody to
 * find, and without an email there is nothing to show, so either is refused.
 */
export function googleSignIn(claims: GoogleClaims): Result<SignInClaims, DomainError> {
  if (claims.sub === '') {
    return invalid('Google named no subject.');
  }
  const email = claims.email?.trim() ?? '';
  if (email === '') {
    return invalid('Google gave no email address.');
  }
  const name = claims.name?.trim() ?? '';
  return ok({
    identity: { provider: 'google', subject: claims.sub },
    profile: { email, name: name === '' ? null : name },
  });
}

/**
 * The domain every test User's address is in. `.invalid` is reserved (RFC 2606),
 * so no test User can have an address that reaches anyone.
 */
export const TEST_EMAIL_DOMAIN = 'test.invalid';

/**
 * A test sign-in. One identifier is one User: the identifier, trimmed, is the
 * subject, so signing in with a new one creates a User the way a first Google
 * sign-in does.
 */
export function testSignIn(identifier: string): Result<SignInClaims, DomainError> {
  const subject = identifier.trim();
  if (subject === '') {
    return invalid('A test sign-in needs an identifier.');
  }
  return ok({
    identity: { provider: 'test', subject },
    profile: { email: `${subject}@${TEST_EMAIL_DOMAIN}`, name: null },
  });
}
