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

// The page reads the database, so it must not be prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.entrySearch.title,
};

type EntrySearchPageProps = {
  readonly searchParams: Promise<SearchQuery>;
};

/**
 * Composition only. The criteria come from the URL's query and the results are
 * what one procedure answered with; `answerEntrySearch` decides which of the
 * two things this page can render it is, and whether a refusal is one of them.
 *
 * A search is a read, so the criteria travel in the query and this page renders
 * them on the read path -- no Server Action, which is the write path. That is
 * also what makes a search reloadable, bookmarkable, shareable, and walkable
 * with the back button.
 *
 * With no Session the procedure refuses and the visitor is sent to sign in, and
 * back to this search once they have -- which is what the query in the return
 * path carries.
 */
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
