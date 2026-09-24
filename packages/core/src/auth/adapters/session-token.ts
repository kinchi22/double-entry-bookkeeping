import { createHash, randomBytes } from 'node:crypto';
import { type SessionToken, type SessionTokenHash } from '../domain/session';

export function newSessionToken(): SessionToken {
  return randomBytes(32).toString('base64url') as SessionToken;
}

export function hashSessionToken(token: string): SessionTokenHash {
  return createHash('sha256').update(token).digest('hex') as SessionTokenHash;
}
