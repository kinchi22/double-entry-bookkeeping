/**
 * The cookie a Session travels in. ADR-0021.
 *
 * The name is part of the specs (`e2e/session.ts`), so it carries no `__Host-`
 * prefix: `E2E build` serves the app over `http://127.0.0.1`.
 */
export const SESSION_COOKIE = 'session';
