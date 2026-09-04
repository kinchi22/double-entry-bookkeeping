/**
 * Public surface of the health feature.
 *
 * Adapters are absent on purpose: they are server-side and are reachable only
 * through @repo/core/server, which carries the `server-only` marker.
 */
export { evaluateHealth } from './domain/status';
export type { ComponentReport, HealthReport } from './domain/status';

export { createGetHealth } from './application/get-health';
export type { GetHealth, GetHealthDependencies } from './application/get-health';

export type { HealthProbe } from './ports/health-probe';
