import { type DomainError, type Result } from '@repo/contracts';
import { type GoogleClaims } from '../domain/user';

export type PendingSignIn = {
  readonly state: string;
  readonly codeVerifier: string;
};

export type GoogleSignIn = {
  readonly begin: (
    redirectUri: URL,
  ) => Promise<
    Result<{ readonly authorizationUrl: URL; readonly pending: PendingSignIn }, DomainError>
  >;
  readonly complete: (
    callbackUrl: URL,
    pending: PendingSignIn,
  ) => Promise<Result<GoogleClaims, DomainError>>;
};
