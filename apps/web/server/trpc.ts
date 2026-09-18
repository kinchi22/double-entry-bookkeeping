import { initTRPC } from '@trpc/server';
import { type AppContext } from './context';
import { toTrpcError } from './domain-error';

const t = initTRPC.context<AppContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/**
 * A procedure that works on a User's data: the session cookie is resolved to an
 * auth context first. A request with no Session still reaches the procedure,
 * signed out, and the use case refuses it; that check is the rule (ADR-0021).
 * Only a Session store that cannot answer fails here.
 */
export const sessionProcedure = t.procedure.use(async ({ ctx, next }) => {
  const auth = await ctx.container.resolveSession(ctx.sessionToken);
  if (!auth.ok) {
    throw toTrpcError(auth.error);
  }
  return next({ ctx: { auth: auth.value } });
});
