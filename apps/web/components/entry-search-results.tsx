import { type PostedEntry } from '@repo/contracts';
import { useId, type ReactNode } from 'react';
import { en } from '../messages/en';
import { EntryList } from './entry-list';

export type EntrySearchResultsProps = {
  readonly entries: readonly PostedEntry[];
};

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
