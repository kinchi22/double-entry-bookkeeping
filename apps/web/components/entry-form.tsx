'use client';

import { ENTRY_FORM_FIELDS, type DomainErrorCode, type Side } from '@repo/contracts';
import { CHART_OF_ACCOUNTS } from '@repo/core/entries';
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type SubmitEvent,
} from 'react';
import { en } from '../messages/en';

/** What the last submission came to. The Server Action returns it. */
export type EntryFormState =
  | { readonly outcome: 'idle' }
  | { readonly outcome: 'saved' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

export type EntryFormProps = {
  /**
   * The Server Action to submit to. Passed in rather than imported, as
   * `RefreshButton` takes its action, so this component stays a form.
   */
  readonly action: (previous: EntryFormState, form: FormData) => Promise<EntryFormState>;
};

const IDLE: EntryFormState = { outcome: 'idle' };

/**
 * The message for each way a submission can be refused. Exhaustive by type, so
 * a new domain error code has to be given copy here before this compiles.
 */
const REFUSAL: Readonly<Record<DomainErrorCode, string>> = {
  UNBALANCED: en.entryForm.unbalanced,
  INVALID_INPUT: en.entryForm.invalid,
  NOT_FOUND: en.entryForm.invalid,
  CONFLICT: en.entryForm.unavailable,
  DEPENDENCY_UNAVAILABLE: en.entryForm.unavailable,
};

/** The Phase 1 form has two lines (ADR-0010), a debit above a credit. */
const LINES: readonly { readonly number: number; readonly side: Side }[] = [
  { number: 1, side: 'debit' },
  { number: 2, side: 'credit' },
];

const SIDES: readonly Side[] = ['debit', 'credit'];

const FIELD = 'flex flex-col gap-1 text-sm';
const CONTROL = 'rounded border border-neutral-300 px-2 py-1';

/**
 * Submits through `onSubmit` rather than the `action` prop. React resets a form
 * after every action it runs, refused ones included, so a refused entry would
 * come back blank; here the fields are reset only once an entry is saved.
 */
export function EntryForm({ action }: EntryFormProps): ReactNode {
  const [state, submitAction, pending] = useActionState(action, IDLE);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();

  useEffect(() => {
    if (state.outcome === 'saved') {
      form.current?.reset();
    }
  }, [state]);

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    startTransition(() => {
      submitAction(fields);
    });
  };

  return (
    <form
      ref={form}
      aria-labelledby={`${id}-title`}
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-300 p-4"
    >
      <h2
        id={`${id}-title`}
        className="text-sm font-semibold uppercase tracking-wide text-neutral-600"
      >
        {en.entryForm.title}
      </h2>

      <div className="flex flex-wrap gap-3">
        <div className={FIELD}>
          <label htmlFor={`${id}-date`}>{en.entryForm.date}</label>
          <input
            id={`${id}-date`}
            name={ENTRY_FORM_FIELDS.entryDate}
            type="date"
            required
            className={CONTROL}
          />
        </div>
        <div className={`${FIELD} grow`}>
          <label htmlFor={`${id}-memo`}>{en.entryForm.memo}</label>
          <input
            id={`${id}-memo`}
            name={ENTRY_FORM_FIELDS.memo}
            type="text"
            required
            className={CONTROL}
          />
        </div>
      </div>

      {LINES.map((line) => {
        const lineId = `${id}-line-${String(line.number)}`;
        return (
          <fieldset key={line.number} className="flex flex-wrap items-end gap-3">
            <legend className="mb-1 text-sm font-medium">
              {en.entryForm.line} {line.number}
            </legend>
            <div className={FIELD}>
              <label htmlFor={`${lineId}-account`}>{en.entryForm.account}</label>
              <select
                id={`${lineId}-account`}
                name={ENTRY_FORM_FIELDS.account}
                required
                defaultValue=""
                className={CONTROL}
              >
                <option value="" disabled>
                  {en.entryForm.chooseAccount}
                </option>
                {CHART_OF_ACCOUNTS.map((code) => (
                  <option key={code} value={code}>
                    {en.accounts[code]}
                  </option>
                ))}
              </select>
            </div>
            <div className={FIELD}>
              <label htmlFor={`${lineId}-side`}>{en.entryForm.side}</label>
              <select
                id={`${lineId}-side`}
                name={ENTRY_FORM_FIELDS.side}
                required
                defaultValue={line.side}
                className={CONTROL}
              >
                {SIDES.map((side) => (
                  <option key={side} value={side}>
                    {en.sides[side]}
                  </option>
                ))}
              </select>
            </div>
            <div className={FIELD}>
              <label htmlFor={`${lineId}-amount`}>{en.entryForm.amount}</label>
              <input
                id={`${lineId}-amount`}
                name={ENTRY_FORM_FIELDS.amount}
                type="text"
                inputMode="numeric"
                pattern="[0-9]+"
                required
                className={`${CONTROL} text-right tabular-nums`}
              />
            </div>
          </fieldset>
        );
      })}

      {state.outcome === 'rejected' ? (
        <p role="alert" className="text-sm text-red-700">
          {REFUSAL[state.code]}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        {pending ? en.entryForm.pending : en.entryForm.submit}
      </button>
    </form>
  );
}
