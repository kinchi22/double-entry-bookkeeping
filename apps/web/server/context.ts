import { cookies } from 'next/headers';
import { getContainer, type Container } from './container';
import { SESSION_COOKIE } from './session-cookie';

export type AppContext = {
  readonly container: Container;
  readonly sessionToken: string | undefined;
};

export async function createContext(): Promise<AppContext> {
  const cookieStore = await cookies();
  return { container: getContainer(), sessionToken: cookieStore.get(SESSION_COOKIE)?.value };
}
