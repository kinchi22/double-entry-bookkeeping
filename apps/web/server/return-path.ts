/**
 * Where a User lands once they sign in. ADR-0021.
 *
 * The path they asked for, accepted only as a path on this origin: a value that
 * could name another site -- `https://evil.test`, `//evil.test`, `/\evil.test`,
 * which browsers read as `//` -- would make sign-in an open redirect. Anything
 * else, or nothing, lands on the entries page.
 *
 * Like `env.ts`, this file does not import `server-only`, so it stays testable.
 */
export const SIGNED_IN_HOME = '/entries';

/** An origin no request can have, to resolve a path against and compare. */
const PROBE = 'http://return-path.invalid';

export function returnPath(requested: unknown): string {
  if (typeof requested !== 'string' || !requested.startsWith('/')) {
    return SIGNED_IN_HOME;
  }
  let url: URL;
  try {
    url = new URL(requested, PROBE);
  } catch {
    return SIGNED_IN_HOME;
  }
  if (url.origin !== PROBE) {
    return SIGNED_IN_HOME;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The sign-in page, remembering where the visitor was going. */
export function signInPath(from: string): string {
  return `/sign-in?${new URLSearchParams({ returnTo: from }).toString()}`;
}
