import { pendingSignInSchema, type PendingSignInInput } from '@repo/contracts';
import { SESSION_LIFETIME_DAYS } from '@repo/core';
import { z } from 'zod';

/**
 * The cookies sign-in writes, and what they hold. ADR-0021.
 *
 * Like `env.ts`, this file does not import `server-only`, so it stays testable;
 * the Server Actions, route handlers and proxy that set the cookies read their
 * names and options here.
 */

/**
 * The cookie a Session travels in. The name is part of the specs
 * (`e2e/session.ts`), so it carries no `__Host-` prefix: `E2E build` serves the
 * app over `http://127.0.0.1`.
 */
export const SESSION_COOKIE = 'session';

const DAY_SECONDS = 24 * 60 * 60;

/**
 * `HttpOnly`, `Secure`, and `SameSite=Lax`, because the return from Google is a
 * top-level cross-site navigation. It lives as long as a Session does, and the
 * proxy renews that on every request that carries it, so the cookie slides with
 * the Session; the sessions table decides whether it still signs anyone in.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_LIFETIME_DAYS * DAY_SECONDS,
} as const;

/** The cookie that holds a sign-in with Google for the length of the round trip. */
export const PENDING_SIGN_IN_COOKIE = 'sign_in_pending';

/** Sent only to the callback, and only for ten minutes. */
export const PENDING_SIGN_IN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/auth/callback/google',
  maxAge: 10 * 60,
} as const;

/** A sign-in with Google in progress, and where the User was going. */
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

/**
 * What the cookie held, or `undefined` when it held nothing this app wrote: a
 * cookie is input from the browser, like a query string.
 */
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

/**
 * Whether the proxy renews the session cookie on this request. A navigation or
 * a read renews it; a write does not, and neither does anything under
 * `/sign-in` or `/auth`, because those set or clear the cookie themselves and a
 * second `Set-Cookie` for the same name would race theirs.
 */
export function renewsSessionCookie(method: string, pathname: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }
  return !['/sign-in', '/auth'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
