import { type SearchQuery } from '@repo/contracts';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { EntrySearchForm } from '../../../../components/entry-search-form';
import { EntrySearchResults } from '../../../../components/entry-search-results';
import { en } from '../../../../messages/en';
import { createContext } from '../../../../server/context';
import { answerEntrySearch } from '../../../../server/entry-search';
import { ENTRY_SEARCH_PATH, pathWithQuery } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.entrySearch.title,
};

type EntrySearchPageProps = {
  readonly searchParams: Promise<SearchQuery>;
};

export default async function EntrySearchPage({
  searchParams,
}: EntrySearchPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const caller = createCaller(await createContext());
  const answer = await answerEntrySearch(
    (criteria) =>
      orSignIn(caller.entries.search(criteria), pathWithQuery(ENTRY_SEARCH_PATH, query)),
    query,
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          <Link href="/">{en.app.name}</Link>
        </h1>
        <Link href="/entries" className="text-sm underline">
          {en.entrySearch.backToEntries}
        </Link>
      </header>
      <EntrySearchForm criteria={answer.criteria} />
      {answer.outcome === 'refused' ? (
        <p role="alert" className="text-sm text-red-700">
          {en.entrySearch.refused}
        </p>
      ) : (
        <EntrySearchResults entries={answer.entries} />
      )}
    </main>
  );
}
