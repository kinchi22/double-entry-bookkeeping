import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  renewsSessionCookie,
} from './server/session-cookie';

/**
 * Next's proxy: the session cookie slides with the Session. ADR-0021.
 *
 * A Session is renewed in the sessions table by a request in the second half of
 * its life, but a page cannot set a cookie while it renders, so the cookie
 * would still end 30 days after sign-in. Here, each request that carries it
 * sets it again for another 30 days. Nothing is read: the table decides whether
 * the token still signs anyone in, and a cookie that outlives its Session is a
 * signed-out visitor.
 *
 * Wiring only, like `instrumentation.ts`; `server/session-cookie.ts` decides.
 */
export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token !== undefined && renewsSessionCookie(request.method, request.nextUrl.pathname)) {
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
