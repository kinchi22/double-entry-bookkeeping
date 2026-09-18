import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createContext } from '../../../../server/context';
import { fromTrpcError } from '../../../../server/domain-error';
import { SIGNED_IN_HOME, returnPath } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import {
  PENDING_SIGN_IN_COOKIE,
  PENDING_SIGN_IN_COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  decodePendingSignIn,
} from '../../../../server/session-cookie';

/**
 * Where Google returns the browser. The pending sign-in is read and forgotten
 * in one step, so a callback is answered once. A callback this browser did not
 * begin -- no pending sign-in, or a state that does not match it -- signs
 * nobody in and returns to `/sign-in` with an error. ADR-0021.
 */
export async function GET(request: Request): Promise<never> {
  const cookieStore = await cookies();
  const kept = decodePendingSignIn(cookieStore.get(PENDING_SIGN_IN_COOKIE)?.value);
  cookieStore.delete({ name: PENDING_SIGN_IN_COOKIE, path: PENDING_SIGN_IN_COOKIE_OPTIONS.path });

  const caller = createCaller(await createContext());
  try {
    const session = await caller.auth.finishGoogleSignIn({
      callbackUrl: request.url,
      pending: kept?.pending,
    });
    cookieStore.set(SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
  } catch (thrown) {
    fromTrpcError(thrown);
    redirect('/sign-in?error=google');
  }
  redirect(kept === undefined ? SIGNED_IN_HOME : returnPath(kept.returnTo));
}
