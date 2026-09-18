import { type Brand, type UserId } from '@repo/contracts';

/**
 * A Session: a User's signed-in state. ADR-0021.
 *
 * The cookie carries a random token, and a Session is stored only by the token's
 * SHA-256 hash, so a read of the stored Sessions signs nobody in. Generating a
 * token and hashing one are the composition root's to supply, because both use
 * `node:crypto`, which no pure layer may import.
 */

/** What the cookie carries. Never stored. */
export type SessionToken = Brand<string, 'SessionToken'>;

/** What a Session is stored and found by. */
export type SessionTokenHash = Brand<string, 'SessionTokenHash'>;

export type Session = {
  readonly tokenHash: SessionTokenHash;
  readonly userId: UserId;
  readonly expiresAt: Date;
};

/**
 * A Session as it is found again. `slides` is false for the Smoke User's, which
 * keeps the fixed expiry it was seeded with and fails the smoke run on the day
 * it ends.
 */
export type StoredSession = Session & {
  readonly slides: boolean;
};

export const SESSION_LIFETIME_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFETIME_MS = SESSION_LIFETIME_DAYS * DAY_MS;

/** When a Session begun, or renewed, at `now` ends. */
export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + LIFETIME_MS);
}

/** What a request at one instant finds a Session to be. */
export type SessionState =
  | { readonly active: false }
  | {
      readonly active: true;
      /** The expiry to store, when this request renews the Session. */
      readonly renewTo: Date | undefined;
    };

/**
 * A Session is over at its expiry, not after it. One that slides is renewed by
 * a request in the second half of its lifetime, and only then, so most requests
 * write nothing.
 */
export function assessSession(session: StoredSession, now: Date): SessionState {
  const remaining = session.expiresAt.getTime() - now.getTime();
  if (remaining <= 0) {
    return { active: false };
  }
  const renews = session.slides && remaining < LIFETIME_MS / 2;
  return { active: true, renewTo: renews ? sessionExpiry(now) : undefined };
}
