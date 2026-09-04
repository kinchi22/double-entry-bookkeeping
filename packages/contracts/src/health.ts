import { z } from 'zod';

/**
 * The Phase 0 pipeline slice. It carries no product meaning: it exists so an
 * empty feature can travel contracts -> core -> db -> router -> page -> tests,
 * and so every CI gate has real code to run against before Phase 1 starts.
 */
export const healthComponentSchema = z.object({
  name: z.string().min(1),
  reachable: z.boolean(),
});

export const healthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded']),
  components: z.array(healthComponentSchema),
  checkedAt: z.date(),
});

export type HealthComponent = z.infer<typeof healthComponentSchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;
