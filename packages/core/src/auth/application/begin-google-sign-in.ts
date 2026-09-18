import { type DomainError, type Result } from '@repo/contracts';
import { type GoogleSignIn, type PendingSignIn } from '../ports/google-sign-in';

export type BeginGoogleSignInDependencies = {
  readonly google: GoogleSignIn;
};

export type BeginGoogleSignIn = () => Promise<
  Result<{ readonly authorizationUrl: URL; readonly pending: PendingSignIn }, DomainError>
>;

/**
 * Where to send the browser to sign in with Google. What it must bring back is
 * the controller's to keep, in a cookie, until the callback.
 */
export function createBeginGoogleSignIn({ google }: BeginGoogleSignInDependencies): BeginGoogleSignIn {
  return () => google.begin();
}
