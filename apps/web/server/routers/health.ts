import { healthStatusSchema } from '@repo/contracts';
import { toTrpcError } from '../domain-error';
import { publicProcedure, router } from '../trpc';

/**
 * Parse input, invoke the use case, map the response. Nothing else.
 *
 * The mapping is where the instant becomes an ISO string. Core deals in `Date`,
 * the contract deals in what JSON can carry, and this is the seam between them.
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
    return {
      status: result.value.status,
      components: [...result.value.components],
      checkedAt: result.value.checkedAt.toISOString(),
    };
  }),
});
