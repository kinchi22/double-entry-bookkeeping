import { SEARCH_CRITERIA_FIELDS, type SearchCriteriaInput } from '@repo/contracts';
import { useId, type ReactNode } from 'react';
import { en } from '../messages/en';
import { ENTRY_SEARCH_PATH } from '../server/return-path';

export type EntrySearchFormProps = {
  /**
   * The criteria the page was asked with, filled back in so that one of them
   * can be adjusted rather than all of them retyped.
   */
  readonly criteria: SearchCriteriaInput;
};

const FIELD = 'flex flex-col gap-1 text-sm';
const CONTROL = 'rounded border border-neutral-300 px-2 py-1';

/**
 * The Search criteria, as a form.
 *
 * A plain `GET` form, not a Server Action: submitting it puts the criteria in
 * the URL's query, which is what makes a search reloadable, bookmarkable and
 * walkable with the back button, and what the page reads them out of. A search
 * is a read, so nothing here goes near the write path. Where it submits is the
 * one constant the page returns a signed-out visitor to.
 *
 * It is a server component. There is no state to keep: the answer to the last
 * search is the page that rendered it.
 */
export function EntrySearchForm({ criteria }: EntrySearchFormProps): ReactNode {
  const id = useId();

  return (
    <form
      aria-labelledby={`${id}-title`}
      action={ENTRY_SEARCH_PATH}
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-300 p-4"
    >
      <h2
        id={`${id}-title`}
        className="w-full text-sm font-semibold uppercase tracking-wide text-neutral-600"
      >
        {en.entrySearch.title}
      </h2>

      <div className={FIELD}>
        <label htmlFor={`${id}-from`}>{en.entrySearch.from}</label>
        <input
          id={`${id}-from`}
          name={SEARCH_CRITERIA_FIELDS.from}
          type="date"
          defaultValue={criteria.from ?? ''}
          className={CONTROL}
        />
      </div>
      <div className={FIELD}>
        <label htmlFor={`${id}-to`}>{en.entrySearch.to}</label>
        <input
          id={`${id}-to`}
          name={SEARCH_CRITERIA_FIELDS.to}
          type="date"
          defaultValue={criteria.to ?? ''}
          className={CONTROL}
        />
      </div>

      <button
        type="submit"
        className="rounded border border-neutral-300 px-3 py-1 text-sm"
      >
        {en.entrySearch.submit}
      </button>
    </form>
  );
}
