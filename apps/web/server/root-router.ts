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

export const createCaller = createCallerFactory(appRouter);
