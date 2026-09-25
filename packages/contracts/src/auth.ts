import { z } from 'zod';
import { type Brand } from './brand';
import { uuidV7Schema } from './id';

export type UserId = Brand<string, 'UserId'>;
export const userIdSchema = uuidV7Schema.transform((id): UserId => id as UserId);

export const pendingSignInSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
});

export type PendingSignInInput = z.infer<typeof pendingSignInSchema>;

export const beganSignInSchema = z.object({
  authorizationUrl: z.url(),
  pending: pendingSignInSchema,
});

export type BeganSignIn = z.infer<typeof beganSignInSchema>;

export const finishGoogleSignInInputSchema = z.object({
  callbackUrl: z.url(),
  pending: pendingSignInSchema.optional(),
});

export const testSignInInputSchema = z.object({
  identifier: z.string(),
});

export const TEST_SIGN_IN_FIELDS = {
  identifier: 'identifier',
  returnTo: 'returnTo',
} as const;

export const issuedSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
});

export type IssuedSessionOutput = z.infer<typeof issuedSessionSchema>;

export function toIssuedSession(session: {
  readonly token: string;
  readonly expiresAt: Date;
}): IssuedSessionOutput {
  return { token: session.token, expiresAt: session.expiresAt.toISOString() };
}

export function toBeganSignIn(began: {
  readonly authorizationUrl: { readonly href: string };
  readonly pending: PendingSignInInput;
}): BeganSignIn {
  return {
    authorizationUrl: began.authorizationUrl.href,
    pending: { state: began.pending.state, codeVerifier: began.pending.codeVerifier },
  };
}
