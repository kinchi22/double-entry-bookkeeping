import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from './session-cookie';

describe('SESSION_COOKIE', () => {
  it('is the name the specs present a Session under (e2e/session.ts)', () => {
    expect(SESSION_COOKIE).toBe('session');
  });
});
