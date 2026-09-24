import {
  domainError,
  err,
  ok,
  type DomainError,
  type HealthState,
  type Result,
} from '@repo/contracts';

export type ComponentReport = {
  readonly name: string;
  readonly reachable: boolean;
};

export type HealthReport = {
  readonly status: HealthState;
  readonly components: readonly ComponentReport[];
  readonly checkedAt: Date;
};

export function evaluateHealth(
  reports: readonly ComponentReport[],
  checkedAt: Date,
): Result<HealthReport, DomainError> {
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
