import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@repo/contracts';
import { googleSignIn, testSignIn } from './user';

describe('googleSignIn', () => {
  it('keeps the subject as the Identity, and the email and name as the profile', () => {
    expect(googleSignIn({ sub: '1234567890', email: 'ada@example.com', name: 'Ada' })).toEqual({
      ok: true,
      value: {
        identity: { provider: 'google', subject: '1234567890' },
        profile: { email: 'ada@example.com', name: 'Ada' },
      },
    });
  });

  it('trims the email and the name', () => {
    const result = googleSignIn({ sub: '1', email: ' ada@example.com\n', name: '  Ada ' });

    expect(isOk(result) && result.value.profile).toEqual({ email: 'ada@example.com', name: 'Ada' });
  });

  it.each([
    ['absent', undefined],
    ['blank', '  '],
  ])('keeps no name when Google gave one that is %s', (_case, name) => {
    const result = googleSignIn({ sub: '1', email: 'ada@example.com', name });

    expect(isOk(result) && result.value.profile.name).toBeNull();
  });

  it('refuses a sign-in with no subject, since there is nobody to find', () => {
    const result = googleSignIn({ sub: '', email: 'ada@example.com', name: 'Ada' });

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'Google named no subject.',
    });
  });

  it.each([
    ['absent', undefined],
    ['blank', ' '],
  ])('refuses a sign-in whose email is %s', (_case, email) => {
    const result = googleSignIn({ sub: '1', email, name: 'Ada' });

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'Google gave no email address.',
    });
  });
});

describe('testSignIn', () => {
  it('makes the identifier the subject, and an address nobody can receive mail at', () => {
    expect(testSignIn('e2e-1')).toEqual({
      ok: true,
      value: {
        identity: { provider: 'test', subject: 'e2e-1' },
        profile: { email: 'e2e-1@test.invalid', name: null },
      },
    });
  });

  it('trims the identifier, so one typed with a space is the same User', () => {
    const result = testSignIn(' e2e-1 ');

    expect(isOk(result) && result.value.identity.subject).toBe('e2e-1');
  });

  it.each(['', '   '])('refuses an identifier that is empty once trimmed: %j', (identifier) => {
    const result = testSignIn(identifier);

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'A test sign-in needs an identifier.',
    });
  });
});
