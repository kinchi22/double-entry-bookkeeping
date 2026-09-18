import { type DomainError, type Result } from '@repo/contracts';
import { type GoogleClaims } from '../domain/user';

/**
 * What the browser keeps for the length of the round trip to Google, in a
 * short-lived cookie of its own. The state ties Google's answer to the browser
 * that asked; the verifier is PKCE's. ADR-0021.
 */
export type PendingSignIn = {
  readonly state: string;
  readonly codeVerifier: string;
};

/**
 * Signing in with Google, as OpenID Connect: discovery, the authorization code
 * with PKCE, and the ID token's signature and claims.
 *
 * Two implementations exist: the `openid-client` adapter and the stub the use
 * case tests run against.
 */
export type GoogleSignIn = {
  /**
   * Where to send the browser, and what it must bring back. `redirectUri` is
   * where Google returns it: this deployment's callback, which Google accepts
   * only if it is registered with the client.
   */
  readonly begin: (
    redirectUri: URL,
  ) => Promise<
    Result<{ readonly authorizationUrl: URL; readonly pending: PendingSignIn }, DomainError>
  >;
  /**
   * The person Google vouches for, from the URL Google returned the browser to,
   * which is the `redirectUri` it was sent with, and the answer in its query.
   * `INVALID_INPUT` when the callback does not answer `pending`, or Google
   * refused; `DEPENDENCY_UNAVAILABLE` when Google could not be reached.
   */
  readonly complete: (
    callbackUrl: URL,
    pending: PendingSignIn,
  ) => Promise<Result<GoogleClaims, DomainError>>;
};
