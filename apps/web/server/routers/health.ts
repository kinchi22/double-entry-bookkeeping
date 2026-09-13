import { healthStatusSchema, toHealthStatus } from '@repo/contracts';
import { toTrpcError } from '../domain-error';
import { publicProcedure, router } from '../trpc';

/**
 * Parse input, invoke the use case, map the response. Nothing else.
 *
 * The `Date` -> ISO mapping is `toHealthStatus`, in `@repo/contracts`. It sat
 * inline here until ADR-0003: this file reaches `../container` through
 * `../trpc`, the container imports `server-only`, and that throws outside a
 * React server runtime -- so a conversion written here is covered by the E2E
 * suite or by nothing.
 *
 * A lint rule caps procedure bodies, so anything that outgrows this shape has
 * to move into core rather than accumulating here.
 */
export const healthRouter = router({
  get: publicProcedure.output(healthStatusSchema).query(async ({ ctx }) => {
    const result = await ctx.container.getHealth();
    if (!result.ok) {
      throw toTrpcError(result.error);
    }
    return toHealthStatus(result.value);
  }),
});
