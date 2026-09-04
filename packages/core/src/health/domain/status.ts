import {
  domainError,
  err,
  ok,
  type DomainError,
  type HealthStatus,
  type Result,
} from '@repo/contracts';

/**
 * What a single checked component reported. Deliberately not a port type: the
 * domain describes the shape of an answer, not how the answer was obtained.
 */
export type ComponentReport = {
  readonly name: string;
  readonly reachable: boolean;
};

/**
 * Pure. No clock, no IO, no environment. `checkedAt` is passed in so this
 * function has exactly one possible output for a given input, which is what
 * makes the mutation-testing gate meaningful.
 */
export function evaluateHealth(
  reports: readonly ComponentReport[],
  checkedAt: Date,
): Result<HealthStatus, DomainError> {
  if (reports.length === 0) {
    return err(
      domainError('INVALID_INPUT', 'Health cannot be evaluated with no components checked.'),
    );
  }

  const unnamed = reports.find((report) => report.name.trim().length === 0);
  if (unnamed !== undefined) {
    return err(domainError('INVALID_INPUT', 'Every checked component must have a name.'));
  }

  const allReachable = reports.every((report) => report.reachable);

  return ok({
    status: allReachable ? 'healthy' : 'degraded',
    components: reports.map((report) => ({
      name: report.name,
      reachable: report.reachable,
    })),
    checkedAt,
  });
}
