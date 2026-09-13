import { z } from 'zod';

/**
 * The Phase 0 pipeline slice. It carries no product meaning: it exists so an
 * empty feature can travel contracts -> core -> db -> router -> page -> tests,
 * and so every CI gate has real code to run against before Phase 1 starts.
 */
export const healthStateSchema = z.enum(['healthy', 'degraded']);

export const healthComponentSchema = z.object({
  name: z.string().min(1),
  reachable: z.boolean(),
});

export const healthStatusSchema = z.object({
  status: healthStateSchema,
  components: z.array(healthComponentSchema),
  /**
   * An instant, as an ISO 8601 string in UTC.
   *
   * A contract describes what crosses a wire, and JSON has no date. A `Date`
   * here would type the value as something the transport cannot carry: over
   * HTTP the router would hand a client a string while the type promised an
   * object, and the mismatch would only surface at the first `.getTime()`.
   * `Date` exists inside core, the string exists on the wire, and
   * `toHealthStatus` below is the one place that converts between them.
   */
  checkedAt: z.iso.datetime(),
});

export type HealthState = z.infer<typeof healthStateSchema>;
export type HealthComponent = z.infer<typeof healthComponentSchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;

/**
 * A health report as core holds it, in the wire form the contract promises.
 *
 * The conversion belongs to the contract rather than to the router. What
 * `checkedAt` has to be is a fact about what JSON can carry, not about tRPC,
 * and the router that used to do it inline is a place no unit test can reach:
 * it imports `./trpc` -> `./context` -> `./container`, and the composition root
 * imports `server-only`, whose `default` export throws anywhere but a React
 * server runtime. Here it is a pure function with a test beside it, which is
 * what the widened unit surface is for. See ADR-0003.
 *
 * The parameter is structural rather than imported. `packages/contracts` has
 * zero internal dependencies -- that property is what makes it safe for every
 * other package to depend on -- so this states the shape it serialises instead
 * of naming core's `HealthReport`, which satisfies it.
 */
export function toHealthStatus(report: {
  readonly status: HealthState;
  readonly components: readonly HealthComponent[];
  readonly checkedAt: Date;
}): HealthStatus {
  // Each component is rebuilt rather than copied across, so the result is the
  // contract's shape and only that: whatever else the caller's objects carry
  // does not travel to the wire, and the array the caller passed is not the one
  // that goes out.
  return {
    status: report.status,
    components: report.components.map((component) => ({
      name: component.name,
      reachable: component.reachable,
    })),
    checkedAt: report.checkedAt.toISOString(),
  };
}
