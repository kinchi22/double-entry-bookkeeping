import { postEntryInputSchema, postedEntrySchema, toPostedEntry } from '@repo/contracts';
import { z } from 'zod';
import { toTrpcError } from '../domain-error';
import { router, sessionProcedure } from '../trpc';

/**
 * Parse input, invoke the use case, map the response. Nothing else.
 *
 * The rules of an entry are decided by the use case, not by the input schema:
 * an unbalanced entry parses here and comes back as `UNBALANCED`. The `Date`
 * to ISO mapping is `toPostedEntry`, beside the schema, for the reason the
 * health router gives.
 */
export const entriesRouter = router({
  list: sessionProcedure.output(z.array(postedEntrySchema)).query(async ({ ctx }) => {
    const result = await ctx.container.listEntries(ctx.auth);
    if (!result.ok) {
      throw toTrpcError(result.error);
    }
    return result.value.map((entry) => toPostedEntry(entry));
  }),

  post: sessionProcedure
    .input(postEntryInputSchema)
    .output(postedEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.postEntry(ctx.auth, input);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toPostedEntry(result.value);
    }),
});
