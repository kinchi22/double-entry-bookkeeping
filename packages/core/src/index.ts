/**
 * Runtime-agnostic surface of @repo/core.
 *
 * Safe from any runtime: pure domain logic, use case factories, and port types.
 * Nothing reachable from here touches a database, a network, or React.
 */
export {
  evaluateHealth,
  createGetHealth,
  type ComponentReport,
  type GetHealth,
  type GetHealthDependencies,
  type HealthProbe,
} from './health/index';
