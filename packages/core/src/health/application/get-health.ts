import { type DomainError, type Result } from '@repo/contracts';
import { evaluateHealth, type ComponentReport, type HealthReport } from '../domain/status';
import { type HealthProbe } from '../ports/health-probe';

export type GetHealthDependencies = {
  readonly probes: readonly HealthProbe[];
  readonly now: () => Date;
};

export type GetHealth = () => Promise<Result<HealthReport, DomainError>>;

export function createGetHealth({ probes, now }: GetHealthDependencies): GetHealth {
  return async (): Promise<Result<HealthReport, DomainError>> => {
    const reports: ComponentReport[] = await Promise.all(
      probes.map(async (probe): Promise<ComponentReport> => {
        const reachable = await probe.check();
        return { name: probe.name, reachable };
      }),
    );

    return evaluateHealth(reports, now());
  };
}
