import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createContext } from '../../../../server/context';
import { appRouter } from '../../../../server/root-router';

const handler = (request: Request): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
