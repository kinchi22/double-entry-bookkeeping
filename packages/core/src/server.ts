import 'server-only';

/**
 * Server-side surface of @repo/core.
 *
 * The `server-only` import above is the gate: if a client component reaches
 * this entry point, the build fails rather than shipping adapter code -- and a
 * connection string with it -- to the browser.
 */
export { createPostgresHealthProbe } from './health/adapters/postgres-health-probe';
export type { PostgresHealthProbe } from './health/adapters/postgres-health-probe';

export { createPostgresEntryRepository } from './entries/adapters/postgres-entry-repository';
export type { PostgresEntryRepository } from './entries/adapters/postgres-entry-repository';

export { createPostgresUserRepository } from './auth/adapters/postgres-user-repository';
export type { PostgresUserRepository } from './auth/adapters/postgres-user-repository';
export { createPostgresSessionRepository } from './auth/adapters/postgres-session-repository';
export type { PostgresSessionRepository } from './auth/adapters/postgres-session-repository';
export { createOpenIdGoogleSignIn } from './auth/adapters/openid-google-sign-in';
export type { OpenIdGoogleSignInOptions } from './auth/adapters/openid-google-sign-in';
export { hashSessionToken, newSessionToken } from './auth/adapters/session-token';
