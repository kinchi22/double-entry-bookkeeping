import { z } from 'zod';
import { type Brand } from './brand';
import { uuidV7Schema } from './id';

/**
 * The authentication slice. ADR-0021.
 *
 * Only a User's id crosses a boundary: a Session token travels in a cookie the
 * browser never reads, and the rest of a User is core's.
 */

export type UserId = Brand<string, 'UserId'>;
export const userIdSchema = uuidV7Schema.transform((id): UserId => id as UserId);

/**
 * What the browser keeps for the round trip to Google: the state that ties
 * Google's answer to it, and the PKCE verifier. It travels in a short-lived
 * cookie of its own, so it is parsed on the way back like any other input.
 */
export const pendingSignInSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
});

export type PendingSignInInput = z.infer<typeof pendingSignInSchema>;

/** Where to send the browser to sign in with Google, and what it must bring back. */
export const beganSignInSchema = z.object({
  authorizationUrl: z.url(),
  pending: pendingSignInSchema,
});

export type BeganSignIn = z.infer<typeof beganSignInSchema>;

/** Finishing a sign-in with Google: the URL Google returned to, and what was kept. */
export const finishGoogleSignInInputSchema = z.object({
  callbackUrl: z.url(),
  pending: pendingSignInSchema.optional(),
});

/** The test sign-in's one field. ADR-0021. */
export const testSignInInputSchema = z.object({
  identifier: z.string(),
});

/**
 * The names the test sign-in form gives its fields: the identifier, and where
 * the User was going. The form renders them and the Server Action reads them.
 */
export const TEST_SIGN_IN_FIELDS = {
  identifier: 'identifier',
  returnTo: 'returnTo',
} as const;

/**
 * A Session as the browser is given it: the token for its cookie, and when it
 * ends. Only a Server Action or a route handler of this app reads it, to set
 * the cookie; the token is never rendered.
 */
export const issuedSessionSchema = z.object({
  token: z.string().min(1),
  /** An instant, as an ISO 8601 string in UTC. See `healthStatusSchema`. */
  expiresAt: z.iso.datetime(),
});

export type IssuedSessionOutput = z.infer<typeof issuedSessionSchema>;

/** A Session as core issues it, in the wire form the contract promises. */
export function toIssuedSession(session: {
  readonly token: string;
  readonly expiresAt: Date;
}): IssuedSessionOutput {
  return { token: session.token, expiresAt: session.expiresAt.toISOString() };
}

/**
 * A began sign-in as core answers it, in the wire form the contract promises.
 * The URL is structural, `{ href }`: this package runs on no platform that
 * promises a `URL`, and core's satisfies it.
 */
export function toBeganSignIn(began: {
  readonly authorizationUrl: { readonly href: string };
  readonly pending: PendingSignInInput;
}): BeganSignIn {
  return {
    authorizationUrl: began.authorizationUrl.href,
    pending: { state: began.pending.state, codeVerifier: began.pending.codeVerifier },
  };
}
