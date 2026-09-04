import { type DomainError, type HealthStatus, type Result } from '@repo/contracts';
import { evaluateHealth, type ComponentReport } from '../domain/status';
import { type HealthProbe } from '../ports/health-probe';

export type GetHealthDependencies = {
  readonly probes: readonly HealthProbe[];
  readonly now: () => Date;
};

export type GetHealth = () => Promise<Result<HealthStatus, DomainError>>;

/**
 * The use case owns orchestration and the transaction boundary. It talks to
 * ports only; it has never heard of Postgres, and could not import the adapter
 * that knows about Postgres even if someone tried.
 */
export function createGetHealth({ probes, now }: GetHealthDependencies): GetHealth {
  return async (): Promise<Result<HealthStatus, DomainError>> => {
    const reports: ComponentReport[] = await Promise.all(
      probes.map(async (probe): Promise<ComponentReport> => {
        const reachable = await probe.check();
        return { name: probe.name, reachable };
      }),
    );

    return evaluateHealth(reports, now());
  };
}
