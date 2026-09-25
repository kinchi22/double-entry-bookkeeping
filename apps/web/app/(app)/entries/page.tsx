import { NO_CRITERIA } from '@repo/core';
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

export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.entriesPage.title,
};

export default async function EntriesPage(): Promise<ReactNode> {
  const caller = createCaller(await createContext());
  const entries = await orSignIn(caller.entries.search(NO_CRITERIA), '/entries');

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          <Link href="/">{en.app.name}</Link>
        </h1>
        <div className="flex items-center gap-4">
          <Link href="/entries/search" className="text-sm underline">
            {en.entriesPage.search}
          </Link>
          <SignOutButton action={signOut} />
        </div>
      </header>
      <EntryForm action={postEntry} />
      <EntryList entries={entries} />
    </main>
  );
}
