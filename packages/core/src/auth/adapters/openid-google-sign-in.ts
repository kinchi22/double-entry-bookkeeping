import * as client from 'openid-client';
import { domainError, err, ok, type DomainError, type Err, type Result } from '@repo/contracts';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
import { type GoogleClaims } from '../domain/user';
import { type GoogleSignIn, type PendingSignIn } from '../ports/google-sign-in';

export type OpenIdGoogleSignInOptions = {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Google. Only this adapter's own test names another issuer. */
  readonly issuer?: URL;
  /** Only this adapter's own test passes any, to reach an issuer over http. */
  readonly discovery?: client.DiscoveryRequestOptions;
};

const GOOGLE = new URL('https://accounts.google.com');

/** An ID token, an email and a name: nothing else is asked of Google. */
const SCOPE = 'openid email profile';

/**
 * Signing in with Google through `openid-client`. ADR-0021.
 *
 * The library does the part of OAuth worth not writing: discovery, the
 * authorization code exchange with PKCE, and validating the ID token's
 * signature and claims. This file only says what to ask for and what to keep.
 *
 * Discovery happens at first use, not at construction, for the reason
 * `getContainer` parses the environment late: `next build` loads the
 * composition root with no network to speak of. A failed discovery is forgotten,
 * so the next sign-in tries again.
 */
export function createOpenIdGoogleSignIn(
  options: OpenIdGoogleSignInOptions,
  logger: Logger,
): GoogleSignIn {
  let discovered: Promise<client.Configuration> | undefined;

  const configuration = async (): Promise<Result<client.Configuration, DomainError>> => {
    discovered ??= client
      .discovery(
        options.issuer ?? GOOGLE,
        options.clientId,
        options.clientSecret,
        undefined,
        options.discovery,
      )
      .then((config) => {
        // An ID token straight from the token endpoint is not signature-checked
        // by default, since TLS already authenticates Google (OpenID Connect
        // Core 3.1.3.7). ADR-0021 has the library validate the signature, so it
        // is asked to: one fetch of Google's keys, cached.
        client.enableNonRepudiationChecks(config);
        return config;
      });
    try {
      return ok(await discovered);
    } catch (error) {
      discovered = undefined;
      return unavailable(logger, 'auth.google_discovery_failed', error);
    }
  };

  return {
    begin: async (redirectUri) => {
      const config = await configuration();
      if (!config.ok) {
        return config;
      }
      const pending: PendingSignIn = {
        state: client.randomState(),
        codeVerifier: client.randomPKCECodeVerifier(),
      };
      const authorizationUrl = client.buildAuthorizationUrl(config.value, {
        redirect_uri: redirectUri.href,
        scope: SCOPE,
        code_challenge: await client.calculatePKCECodeChallenge(pending.codeVerifier),
        code_challenge_method: 'S256',
        state: pending.state,
      });
      return ok({ authorizationUrl, pending });
    },

    complete: async (callbackUrl, pending) => {
      const config = await configuration();
      if (!config.ok) {
        return config;
      }
      let claims: client.IDToken | undefined;
      try {
        const tokens = await client.authorizationCodeGrant(config.value, callbackUrl, {
          pkceCodeVerifier: pending.codeVerifier,
          expectedState: pending.state,
          idTokenExpected: true,
        });
        claims = tokens.claims();
      } catch (error) {
        return refusedOrUnavailable(logger, error);
      }
      if (claims === undefined) {
        return refused(logger, 'Google answered with no ID token.');
      }
      return ok(googleClaims(claims));
    },
  };
}

function googleClaims(claims: client.IDToken): GoogleClaims {
  return {
    sub: claims.sub,
    email: typeof claims['email'] === 'string' ? claims['email'] : undefined,
    name: typeof claims['name'] === 'string' ? claims['name'] : undefined,
  };
}

/**
 * Whether Google, or the browser, said no -- a state that does not match, a
 * code Google will not exchange, an ID token that does not verify, a person who
 * declined -- or whether Google could not be asked at all.
 */
function refusedOrUnavailable(logger: Logger, error: unknown): Err<DomainError> {
  const said =
    error instanceof client.ClientError ||
    error instanceof client.ResponseBodyError ||
    error instanceof client.AuthorizationResponseError;
  if (!said) {
    return unavailable(logger, 'auth.google_exchange_failed', error);
  }
  logger.error(
    { event: 'auth.google_sign_in_refused', error: describeError(error) },
    'A sign-in with Google was refused.',
  );
  return err(domainError('INVALID_INPUT', 'The sign-in with Google was refused.'));
}

function refused(logger: Logger, message: string): Err<DomainError> {
  logger.error({ event: 'auth.google_sign_in_refused' }, message);
  return err(domainError('INVALID_INPUT', message));
}

function unavailable(logger: Logger, event: string, error: unknown): Err<DomainError> {
  logger.error({ event, error: describeError(error) }, 'Google could not be reached.');
  return err(domainError('DEPENDENCY_UNAVAILABLE', 'Google could not be reached.'));
}
