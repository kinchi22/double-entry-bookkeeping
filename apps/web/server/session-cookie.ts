import { pendingSignInSchema, type PendingSignInInput } from '@repo/contracts';
import { SESSION_LIFETIME_DAYS } from '@repo/core';
import { z } from 'zod';

export const SESSION_COOKIE = 'session';

const DAY_SECONDS = 24 * 60 * 60;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_LIFETIME_DAYS * DAY_SECONDS,
} as const;

export const PENDING_SIGN_IN_COOKIE = 'sign_in_pending';

export const PENDING_SIGN_IN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/auth/callback/google',
  maxAge: 10 * 60,
} as const;

export type PendingSignInCookie = {
  readonly pending: PendingSignInInput;
  readonly returnTo: string;
};

const pendingSignInCookieSchema = z.object({
  pending: pendingSignInSchema,
  returnTo: z.string(),
});

export function encodePendingSignIn(value: PendingSignInCookie): string {
  return JSON.stringify({
    pending: { state: value.pending.state, codeVerifier: value.pending.codeVerifier },
    returnTo: value.returnTo,
  });
}

export function decodePendingSignIn(value: string | undefined): PendingSignInCookie | undefined {
  let json: unknown;
  try {
    json = JSON.parse(value ?? '');
  } catch {
    return undefined;
  }
  const parsed = pendingSignInCookieSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

export function renewsSessionCookie(method: string, pathname: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }
  return !['/sign-in', '/auth'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
