import { describe, expect, it } from 'vitest';
import { type UserId } from '@repo/contracts';
import { SIGNED_OUT, requireUser } from './auth-context';

describe('SIGNED_OUT', () => {
  it('names no User', () => {
    expect(SIGNED_OUT).toStrictEqual({ userId: undefined });
  });
});

describe('requireUser', () => {
  it('answers with the signed-in User', () => {
    const userId = '01920000-0000-7000-8000-000000000001' as UserId;

    expect(requireUser({ userId })).toEqual({ ok: true, value: userId });
  });

  it('refuses a request with no Session as unauthenticated', () => {
    expect(requireUser(SIGNED_OUT)).toEqual({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'This needs a signed-in User.' },
    });
  });
});
