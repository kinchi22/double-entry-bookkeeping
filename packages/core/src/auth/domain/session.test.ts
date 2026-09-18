import { describe, expect, it } from 'vitest';
import { type UserId } from '@repo/contracts';
import {
  assessSession,
  sessionExpiry,
  type SessionTokenHash,
  type StoredSession,
} from './session';

const NOW = new Date('2026-09-18T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const at = (offset: number): Date => new Date(NOW.getTime() + offset);

const session = (expiresAt: Date, slides = true): StoredSession => ({
  tokenHash: 'hash' as SessionTokenHash,
  userId: '01920000-0000-7000-8000-000000000001' as UserId,
  expiresAt,
  slides,
});

describe('sessionExpiry', () => {
  it('ends a Session 30 days after it begins', () => {
    expect(sessionExpiry(NOW)).toEqual(new Date('2026-10-18T12:00:00.000Z'));
  });
});

describe('assessSession', () => {
  it('keeps a Session in the first half of its lifetime as it is', () => {
    expect(assessSession(session(at(20 * DAY)), NOW)).toEqual({ active: true, renewTo: undefined });
  });

  it('keeps a Session exactly halfway through as it is: the second half has not begun', () => {
    expect(assessSession(session(at(15 * DAY)), NOW)).toEqual({ active: true, renewTo: undefined });
  });

  it('renews a Session in the second half of its lifetime for another 30 days', () => {
    expect(assessSession(session(at(15 * DAY - 1)), NOW)).toEqual({
      active: true,
      renewTo: sessionExpiry(NOW),
    });
  });

  it('never renews a Session that does not slide', () => {
    expect(assessSession(session(at(1), false), NOW)).toEqual({ active: true, renewTo: undefined });
  });

  it('ends a Session at its expiry, not after it', () => {
    expect(assessSession(session(at(0)), NOW)).toEqual({ active: false });
    expect(assessSession(session(at(1)), NOW)).toEqual({ active: true, renewTo: sessionExpiry(NOW) });
  });

  it('ends a Session past its expiry, sliding or not', () => {
    expect(assessSession(session(at(-DAY)), NOW)).toEqual({ active: false });
    expect(assessSession(session(at(-DAY), false), NOW)).toEqual({ active: false });
  });
});
