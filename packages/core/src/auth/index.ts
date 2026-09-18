/**
 * Public surface of the auth feature.
 *
 * Adapters are absent on purpose, as in the health feature: they are reachable
 * only through @repo/core/server, which carries the `server-only` marker.
 */
export { SIGNED_OUT, requireUser } from './domain/auth-context';
export type { AuthContext } from './domain/auth-context';

export { SESSION_LIFETIME_DAYS, assessSession, sessionExpiry } from './domain/session';
export type {
  Session,
  SessionState,
  SessionToken,
  SessionTokenHash,
  StoredSession,
} from './domain/session';

export { TEST_EMAIL_DOMAIN, googleSignIn, testSignIn } from './domain/user';
export type {
  GoogleClaims,
  Identity,
  IdentityProvider,
  Profile,
  SignInClaims,
  User,
} from './domain/user';

export { createFinishGoogleSignIn, createTestSignIn } from './application/sign-in';
export type {
  FinishGoogleSignIn,
  IssuedSession,
  SignInDependencies,
  TestSignIn,
} from './application/sign-in';

export { createBeginGoogleSignIn } from './application/begin-google-sign-in';
export type {
  BeginGoogleSignIn,
  BeginGoogleSignInDependencies,
} from './application/begin-google-sign-in';

export { createResolveSession } from './application/resolve-session';
export type { ResolveSession, ResolveSessionDependencies } from './application/resolve-session';

export { createSignOut } from './application/sign-out';
export type { SignOut, SignOutDependencies } from './application/sign-out';

export type { GoogleSignIn, PendingSignIn } from './ports/google-sign-in';
export type { SessionRepository } from './ports/session-repository';
export type { UserRepository } from './ports/user-repository';
