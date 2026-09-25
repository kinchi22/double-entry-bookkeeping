import { type Brand, type UserId } from '@repo/contracts';

export type SessionToken = Brand<string, 'SessionToken'>;

export type SessionTokenHash = Brand<string, 'SessionTokenHash'>;

export type Session = {
  readonly tokenHash: SessionTokenHash;
  readonly userId: UserId;
  readonly expiresAt: Date;
};

export type StoredSession = Session & {
  readonly slides: boolean;
};

export const SESSION_LIFETIME_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFETIME_MS = SESSION_LIFETIME_DAYS * DAY_MS;

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + LIFETIME_MS);
}

export type SessionState =
  | { readonly active: false }
  | {
      readonly active: true;
      readonly renewTo: Date | undefined;
    };

export function assessSession(session: StoredSession, now: Date): SessionState {
  const remaining = session.expiresAt.getTime() - now.getTime();
  if (remaining <= 0) {
    return { active: false };
  }
  const renews = session.slides && remaining < LIFETIME_MS / 2;
  return { active: true, renewTo: renews ? sessionExpiry(now) : undefined };
}
