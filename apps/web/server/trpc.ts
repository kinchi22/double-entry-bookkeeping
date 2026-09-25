import { initTRPC } from '@trpc/server';
import { type AppContext } from './context';
import { toTrpcError } from './domain-error';

const t = initTRPC.context<AppContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const sessionProcedure = t.procedure.use(async ({ ctx, next }) => {
  const auth = await ctx.container.resolveSession(ctx.sessionToken);
  if (!auth.ok) {
    throw toTrpcError(auth.error);
  }
  return next({ ctx: { auth: auth.value } });
});
