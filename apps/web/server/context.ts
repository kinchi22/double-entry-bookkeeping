import { cookies } from 'next/headers';
import { getContainer, type Container } from './container';
import { SESSION_COOKIE } from './session-cookie';

/**
 * What every procedure is called with: the composition root, and whatever the
 * session cookie held. Who that signs in is resolved only by the procedures that
 * need to know (`sessionProcedure` in `./trpc`), so `health.get` answers without
 * a database read of its own. ADR-0020, ADR-0021.
 */
export type AppContext = {
  readonly container: Container;
  readonly sessionToken: string | undefined;
};

export async function createContext(): Promise<AppContext> {
  const cookieStore = await cookies();
  return { container: getContainer(), sessionToken: cookieStore.get(SESSION_COOKIE)?.value };
}
