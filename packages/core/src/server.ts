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
