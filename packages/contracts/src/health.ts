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
   * `Date` exists inside core, the string exists on the wire, and the router
   * converts between them.
   */
  checkedAt: z.iso.datetime(),
});

export type HealthState = z.infer<typeof healthStateSchema>;
export type HealthComponent = z.infer<typeof healthComponentSchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;
