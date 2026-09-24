import { healthStatusSchema, toHealthStatus } from '@repo/contracts';
import { toTrpcError } from '../domain-error';
import { publicProcedure, router } from '../trpc';

export const healthRouter = router({
  get: publicProcedure.output(healthStatusSchema).query(async ({ ctx }) => {
    const result = await ctx.container.getHealth();
    if (!result.ok) {
      throw toTrpcError(result.error);
    }
    return toHealthStatus(result.value);
  }),
});
