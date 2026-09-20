import Link from 'next/link';
import { type ReactNode } from 'react';
import { EntryForm } from '../../../components/entry-form';
import { EntryList } from '../../../components/entry-list';
import { SignOutButton } from '../../../components/sign-out-button';
import { en } from '../../../messages/en';
import { createContext } from '../../../server/context';
import { createCaller } from '../../../server/root-router';
import { orSignIn } from '../../../server/sign-in-redirect';
import { postEntry, signOut } from './actions';

// The page reads the database, so it must not be prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.entriesPage.title,
};

/**
 * Composition only. The page lists what one procedure returns and hands the
 * form its action; which entries exist, in what order, and whether a new one
 * balances are all decided in core.
 */
export default async function EntriesPage(): Promise<ReactNode> {
  const caller = createCaller(await createContext());
  // With no Session the procedure refuses, and the visitor is sent to sign in.
  const entries = await orSignIn(caller.entries.search(), '/entries');

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          <Link href="/">{en.app.name}</Link>
        </h1>
        <SignOutButton action={signOut} />
      </header>
      <EntryForm action={postEntry} />
      <EntryList entries={entries} />
    </main>
  );
}
