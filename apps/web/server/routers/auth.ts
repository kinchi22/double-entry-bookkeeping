import {
  beganSignInSchema,
  finishGoogleSignInInputSchema,
  issuedSessionSchema,
  testSignInInputSchema,
  toBeganSignIn,
  toIssuedSession,
} from '@repo/contracts';
import { z } from 'zod';
import { toTrpcError } from '../domain-error';
import { publicProcedure, router, sessionProcedure } from '../trpc';

export const authRouter = router({
  signedIn: sessionProcedure.output(z.boolean()).query(({ ctx }) => ctx.auth.userId !== undefined),

  testSignInOffered: publicProcedure
    .output(z.boolean())
    .query(({ ctx }) => ctx.container.testSignInOffered),

  beginGoogleSignIn: publicProcedure
    .input(z.object({ redirectUri: z.url() }))
    .output(beganSignInSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.beginGoogleSignIn(new URL(input.redirectUri));
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toBeganSignIn(result.value);
    }),

  finishGoogleSignIn: publicProcedure
    .input(finishGoogleSignInInputSchema)
    .output(issuedSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.finishGoogleSignIn(new URL(input.callbackUrl), input.pending);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toIssuedSession(result.value);
    }),

  testSignIn: publicProcedure
    .input(testSignInInputSchema)
    .output(issuedSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.container.testSignIn(input.identifier);
      if (!result.ok) {
        throw toTrpcError(result.error);
      }
      return toIssuedSession(result.value);
    }),

  signOut: publicProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.container.signOut(ctx.sessionToken);
    if (!result.ok) {
      throw toTrpcError(result.error);
    }
  }),
});
