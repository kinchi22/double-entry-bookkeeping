import { type ReactNode } from 'react';
import { TestSignInForm } from '../../../components/test-sign-in-form';
import { en } from '../../../messages/en';
import { createContext } from '../../../server/context';
import { returnPath } from '../../../server/return-path';
import { createCaller } from '../../../server/root-router';
import { signInWithTestIdentifier } from './actions';

// The page reads configuration at request time, so it must not be prerendered.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.signInPage.title,
};

type SignInPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

/**
 * Composition only. Google is the way in; the test sign-in is offered beside it
 * only where `AUTH_TEST_LOGIN` is set. `error` is set by a sign-in with Google
 * that failed, and `returnTo` by the page that sent the visitor here. ADR-0021.
 */
export default async function SignInPage({ searchParams }: SignInPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const returnTo = returnPath(query['returnTo']);
  const caller = createCaller(await createContext());
  const testSignInOffered = await caller.auth.testSignInOffered();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">{en.signInPage.title}</h1>
      {query['error'] === undefined ? null : (
        <p role="alert" className="text-sm text-red-700">
          {en.signInPage.failed}
        </p>
      )}
      {/* A plain link, not `next/link`: it leads to a route handler, which must not be prefetched. */}
      <a
        href={`/sign-in/google?${new URLSearchParams({ returnTo }).toString()}`}
        className="self-start rounded border border-neutral-300 px-3 py-1 text-sm"
      >
        {en.signInPage.google}
      </a>
      {testSignInOffered ? (
        <TestSignInForm returnTo={returnTo} action={signInWithTestIdentifier} />
      ) : null}
    </main>
  );
}
