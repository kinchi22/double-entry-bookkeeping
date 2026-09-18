import { describe, expect, it } from 'vitest';
import { hashSessionToken, newSessionToken } from './session-token';

describe('newSessionToken', () => {
  it('is 32 random bytes, in a form a cookie carries as it is', () => {
    const token = newSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('is a different token every time', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => newSessionToken()));

    expect(tokens.size).toBe(100);
  });
});

describe('hashSessionToken', () => {
  it('is the SHA-256 of the token, hex encoded', () => {
    // echo -n abc | sha256sum
    expect(hashSessionToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is the same for the same token, so a Session is found again by it', () => {
    const token = newSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });
});
