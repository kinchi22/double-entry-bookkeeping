import * as client from 'openid-client';
import { domainError, err, ok, type DomainError, type Err, type Result } from '@repo/contracts';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
import { type GoogleClaims } from '../domain/user';
import { type GoogleSignIn, type PendingSignIn } from '../ports/google-sign-in';

export type OpenIdGoogleSignInOptions = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly issuer?: URL;
  readonly discovery?: client.DiscoveryRequestOptions;
};

const GOOGLE = new URL('https://accounts.google.com');

const SCOPE = 'openid email profile';

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
