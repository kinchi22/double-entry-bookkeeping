import {
  postEntryInputSchema,
  postedEntrySchema,
  searchCriteriaSchema,
  toPostedEntry,
} from '@repo/contracts';
import { z } from 'zod';
import { toTrpcError } from '../domain-error';
import { router, sessionProcedure } from '../trpc';

export const entriesRouter = router({
  search: sessionProcedure
    .input(searchCriteriaSchema.default({}))
    .output(z.array(postedEntrySchema))
    .query(async ({ ctx, input }) => {
      const result = await ctx.container.searchEntries(ctx.auth, input);
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
