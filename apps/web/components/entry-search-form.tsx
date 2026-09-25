import { SEARCH_CRITERIA_FIELDS, type SearchCriteriaInput } from '@repo/contracts';
import { CHART_OF_ACCOUNTS } from '@repo/core/entries';
import { useId, type ReactNode } from 'react';
import { en } from '../messages/en';
import { ENTRY_SEARCH_PATH } from '../server/return-path';

export type EntrySearchFormProps = {
  readonly criteria: SearchCriteriaInput;
};

const FIELD = 'flex flex-col gap-1 text-sm';
const CONTROL = 'rounded border border-neutral-300 px-2 py-1';

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
