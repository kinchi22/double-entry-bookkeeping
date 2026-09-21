import { parseSearchQuery, type PostedEntry, type SearchCriteriaInput } from '@repo/contracts';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { EntrySearchForm } from '../../../../components/entry-search-form';
import { EntrySearchResults } from '../../../../components/entry-search-results';
import { en } from '../../../../messages/en';
import { createContext } from '../../../../server/context';
import { fromTrpcError } from '../../../../server/domain-error';
import { pathWithQuery, type QueryParameters } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';

// The page reads the database, so it must not be prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.entrySearch.title,
};

const SEARCH_PATH = '/entries/search';

type EntrySearchPageProps = {
  readonly searchParams: Promise<QueryParameters>;
};

/**
 * The Entry search: the criteria come from the URL's query and the results are
 * what one procedure answered with.
 *
 * A search is a read, so the criteria travel in the query and the page renders
 * them on the read path -- no Server Action, which is the write path. That is
 * also what makes a search reloadable, bookmarkable, shareable, and walkable
 * with the back button.
 *
 * A refusal is an answer this page renders rather than an error it fails on,
 * for the reason the entry form gives. There are two ways criteria can be
 * refused and one code between them: a day that is not a calendar day is
 * refused by the contract before anything is asked, and a range that ends
 * before it starts is refused by the domain, which the procedure raises. Either
 * way the page explains and shows no results at all, because results would be
 * the answer to a question other than the one the URL states.
 */
export default async function EntrySearchPage({
  searchParams,
}: EntrySearchPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const criteria = parseSearchQuery(query);
  const found = criteria.ok
    ? await search(criteria.value, pathWithQuery(SEARCH_PATH, query))
    : undefined;

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
      <EntrySearchForm criteria={criteria.ok ? criteria.value : EMPTY_CRITERIA} />
      {found === undefined ? (
        <p role="alert" className="text-sm text-red-700">
          {en.entrySearch.refused}
        </p>
      ) : (
        <EntrySearchResults entries={found} />
      )}
    </main>
  );
}

/** Nothing to fill back in, because nothing the URL held was a criterion. */
const EMPTY_CRITERIA: SearchCriteriaInput = {};

/**
 * The entries the criteria match, or nothing at all when the criteria break a
 * rule. With no Session the visitor is sent to sign in and back to this search
 * once they have, which is what `from` carries. Anything that is not a refusal
 * of these criteria is rethrown by `fromTrpcError`, so a defect still reaches
 * the error boundary.
 */
async function search(
  criteria: SearchCriteriaInput,
  from: string,
): Promise<readonly PostedEntry[] | undefined> {
  const caller = createCaller(await createContext());
  try {
    return await orSignIn(caller.entries.search(criteria), from);
  } catch (thrown) {
    if (fromTrpcError(thrown).code === 'INVALID_INPUT') {
      return undefined;
    }
    throw thrown;
  }
}
