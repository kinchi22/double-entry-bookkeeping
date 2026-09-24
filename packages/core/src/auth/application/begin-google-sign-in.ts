import { type DomainError, type Result } from '@repo/contracts';
import { type GoogleSignIn, type PendingSignIn } from '../ports/google-sign-in';

export type BeginGoogleSignInDependencies = {
  readonly google: GoogleSignIn;
};

export type BeginGoogleSignIn = (
  redirectUri: URL,
) => Promise<
  Result<{ readonly authorizationUrl: URL; readonly pending: PendingSignIn }, DomainError>
>;

export function createBeginGoogleSignIn({ google }: BeginGoogleSignInDependencies): BeginGoogleSignIn {
  return (redirectUri) => google.begin(redirectUri);
}
