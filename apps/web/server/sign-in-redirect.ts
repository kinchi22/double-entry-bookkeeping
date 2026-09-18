import { TRPCError } from '@trpc/server';
import { redirect } from 'next/navigation';
import { signInPath } from './return-path';

/**
 * What a page shows a visitor with no Session: the sign-in page, which returns
 * them to `from` once they sign in. ADR-0021.
 *
 * A courtesy, and only that. The procedure behind the page already refused the
 * call, `UNAUTHORIZED`, because its use case checked; this turns that refusal
 * into a redirect instead of an error page. Anything else is rethrown.
 *
 * Like `env.ts`, this file does not import `server-only`, so it stays testable.
 */
export async function orSignIn<T>(call: Promise<T>, from: string): Promise<T> {
  try {
    return await call;
  } catch (thrown) {
    if (thrown instanceof TRPCError && thrown.code === 'UNAUTHORIZED') {
      redirect(signInPath(from));
    }
    throw thrown;
  }
}
