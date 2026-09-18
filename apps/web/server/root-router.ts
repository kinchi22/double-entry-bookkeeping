import { createCallerFactory, router } from './trpc';
import { authRouter } from './routers/auth';
import { entriesRouter } from './routers/entries';
import { healthRouter } from './routers/health';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  entries: entriesRouter,
});

export type AppRouter = typeof appRouter;

/**
 * Lets a React Server Component invoke a procedure in-process, with no HTTP hop,
 * while still going through exactly the same router the network path uses.
 */
export const createCaller = createCallerFactory(appRouter);
