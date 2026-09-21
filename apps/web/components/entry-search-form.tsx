import { SEARCH_CRITERIA_FIELDS, type SearchCriteriaInput } from '@repo/contracts';
import { CHART_OF_ACCOUNTS } from '@repo/core/entries';
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

      <div className={FIELD}>
        <label htmlFor={`${id}-account`}>{en.entrySearch.account}</label>
        {/*
          A list of the Chart of accounts rather than a box, so an Account that
          cannot exist cannot be searched for. "Any account" is the criterion
          dropped, and it is a choice in the list rather than an empty box, so
          it can be chosen back without clearing the other criteria. It submits
          nothing, which is how an absent criterion reaches the page.
        */}
        <select
          id={`${id}-account`}
          name={SEARCH_CRITERIA_FIELDS.account}
          defaultValue={criteria.account ?? ''}
          className={CONTROL}
        >
          <option value="">{en.entrySearch.anyAccount}</option>
          {CHART_OF_ACCOUNTS.map((code) => (
            <option key={code} value={code}>
              {en.accounts[code]}
            </option>
          ))}
        </select>
      </div>

      <div className={`${FIELD} grow`}>
        <label htmlFor={`${id}-memo`}>{en.entrySearch.memo}</label>
        {/*
          A plain box: what is typed is looked for literally, so there is no
          pattern to learn and nothing to escape. It is not `required` and it is
          not capped here -- an empty box and one holding only spaces are both
          the criterion dropped, and how long a term may be is the domain's rule
          rather than a second one stated in the markup.
        */}
        <input
          id={`${id}-memo`}
          name={SEARCH_CRITERIA_FIELDS.memo}
          type="text"
          defaultValue={criteria.memo ?? ''}
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
