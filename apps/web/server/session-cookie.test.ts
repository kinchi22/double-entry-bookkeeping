import { describe, expect, it } from 'vitest';
import {
  PENDING_SIGN_IN_COOKIE,
  PENDING_SIGN_IN_COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  decodePendingSignIn,
  encodePendingSignIn,
  renewsSessionCookie,
} from './session-cookie';

describe('SESSION_COOKIE', () => {
  it('is the name the specs present a Session under (e2e/session.ts)', () => {
    expect(SESSION_COOKIE).toBe('session');
  });

  it('is out of reach of scripts, sent over TLS, survives a return from Google, and lasts 30 days', () => {
    expect(SESSION_COOKIE_OPTIONS).toStrictEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 2_592_000,
    });
  });
});

describe('PENDING_SIGN_IN_COOKIE', () => {
  it('is a cookie of its own, sent only to the callback, for ten minutes', () => {
    expect(PENDING_SIGN_IN_COOKIE).toBe('sign_in_pending');
    expect(PENDING_SIGN_IN_COOKIE_OPTIONS).toStrictEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/auth/callback/google',
      maxAge: 600,
    });
  });
});

describe('decodePendingSignIn', () => {
  const PENDING = { pending: { state: 'state', codeVerifier: 'verifier' }, returnTo: '/entries' };

  it('reads back what encodePendingSignIn wrote', () => {
    expect(decodePendingSignIn(encodePendingSignIn(PENDING))).toStrictEqual(PENDING);
  });

  it('writes nothing but the pending sign-in and the path', () => {
    const extra = { ...PENDING, pending: { ...PENDING.pending, nonce: 'n' }, other: 1 };

    expect(JSON.parse(encodePendingSignIn(extra))).toStrictEqual(PENDING);
  });

  it.each([
    ['no cookie', undefined],
    ['text that is not JSON', 'state=forged'],
    ['JSON of another shape', '{"state":"forged"}'],
    ['a pending sign-in with no path', '{"pending":{"state":"s","codeVerifier":"v"}}'],
  ])('reads nothing from %s', (_case, value) => {
    expect(decodePendingSignIn(value)).toBeUndefined();
  });
});

describe('renewsSessionCookie', () => {
  it.each([
    ['GET', '/entries'],
    ['HEAD', '/entries'],
    ['GET', '/'],
    ['GET', '/api/trpc/entries.list'],
    ['GET', '/sign-inside'],
    ['GET', '/authors'],
  ])('renews it on %s %s', (method, pathname) => {
    expect(renewsSessionCookie(method, pathname)).toBe(true);
  });

  it.each([
    ['POST', '/entries'],
    ['POST', '/api/trpc/entries.post'],
    ['GET', '/sign-in'],
    ['GET', '/sign-in/google'],
    ['GET', '/auth'],
    ['GET', '/auth/callback/google'],
  ])('leaves it to %s %s', (method, pathname) => {
    expect(renewsSessionCookie(method, pathname)).toBe(false);
  });
});
