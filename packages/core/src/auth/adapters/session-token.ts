import { createHash, randomBytes } from 'node:crypto';
import { type SessionToken, type SessionTokenHash } from '../domain/session';

/**
 * A Session's token, and the hash it is stored by. ADR-0021.
 *
 * An adapter because both need `node:crypto`, which no pure layer may import.
 * The composition root hands them to the use cases, the way it hands them an id
 * generator.
 */

/** 32 random bytes, base64url, so the token is safe in a cookie as it is. */
export function newSessionToken(): SessionToken {
  return randomBytes(32).toString('base64url') as SessionToken;
}

/**
 * SHA-256, hex. A token has 256 bits of entropy, so an unsalted fast hash is
 * enough: what it defends against is a read of the table, not a guess.
 */
export function hashSessionToken(token: string): SessionTokenHash {
  return createHash('sha256').update(token).digest('hex') as SessionTokenHash;
}
