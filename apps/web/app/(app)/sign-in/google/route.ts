import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createContext } from '../../../../server/context';
import { fromTrpcError } from '../../../../server/domain-error';
import { returnPath } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import {
  PENDING_SIGN_IN_COOKIE,
  PENDING_SIGN_IN_COOKIE_OPTIONS,
  encodePendingSignIn,
} from '../../../../server/session-cookie';

/**
 * Begins a sign-in with Google: keeps the state and the PKCE verifier in a
 * cookie of their own, with where the visitor was going, and sends the browser
 * to Google. Google returns it to this deployment's callback. ADR-0021.
 */
export async function GET(request: Request): Promise<never> {
  const url = new URL(request.url);
  const caller = createCaller(await createContext());
  let began;
  try {
    began = await caller.auth.beginGoogleSignIn({
      redirectUri: new URL('/auth/callback/google', url).href,
    });
  } catch (thrown) {
    fromTrpcError(thrown);
    redirect('/sign-in?error=google');
  }
  const kept = { pending: began.pending, returnTo: returnPath(url.searchParams.get('returnTo')) };
  (await cookies()).set(PENDING_SIGN_IN_COOKIE, encodePendingSignIn(kept), PENDING_SIGN_IN_COOKIE_OPTIONS);
  redirect(began.authorizationUrl);
}
