import {
  domainError,
  err,
  ok,
  type DomainError,
  type Err,
  type Result,
  type UserId,
} from '@repo/contracts';

export type User = {
  readonly id: UserId;
  readonly email: string;
  readonly name: string | null;
  readonly createdAt: Date;
};

export type IdentityProvider = 'google' | 'test';

export type Identity = {
  readonly provider: IdentityProvider;
  readonly subject: string;
};

export type Profile = {
  readonly email: string;
  readonly name: string | null;
};

export type SignInClaims = {
  readonly identity: Identity;
  readonly profile: Profile;
};

export type GoogleClaims = {
  readonly sub: string;
  readonly email: string | undefined;
  readonly name: string | undefined;
};

const invalid = (message: string): Err<DomainError> =>
  err(domainError('INVALID_INPUT', message));

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

export const TEST_EMAIL_DOMAIN = 'test.invalid';

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
