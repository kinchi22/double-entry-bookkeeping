import { type PostedEntry } from '@repo/contracts';
import { useId, type ReactNode } from 'react';
import { en } from '../messages/en';
import { EntryList } from './entry-list';

export type EntrySearchResultsProps = {
  readonly entries: readonly PostedEntry[];
};

/**
 * What an Entry search answered.
 *
 * The region is named `Results` rather than `Entries`, so that what is asserted
 * about this page is that the search answered rather than that some list
 * rendered. It stays on the page when the answer is empty, because an honest
 * empty answer has to be tellable apart from a page that failed.
 *
 * The empty state is this page's own and says that nothing matched. `EntryList`
 * has one too, and it says that nothing has been written yet: the two
 * emptinesses are different answers, and one message would be wrong for one of
 * them, so the list is reused exactly as `/entries` renders it and this is
 * rendered instead of it.
 */
export function EntrySearchResults({ entries }: EntrySearchResultsProps): ReactNode {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h2
        id={titleId}
        className="text-sm font-semibold uppercase tracking-wide text-neutral-600"
      >
        {en.entrySearch.results}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-600">{en.entrySearch.nothingMatched}</p>
      ) : (
        <EntryList entries={entries} />
      )}
    </section>
  );
}
