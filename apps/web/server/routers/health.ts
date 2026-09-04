import { healthStatusSchema } from '@repo/contracts';
import { toTrpcError } from '../domain-error';
import { publicProcedure, router } from '../trpc';

/**
 * Parse input, invoke the use case, map the response. Nothing else.
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
    return result.value;
  }),
});
