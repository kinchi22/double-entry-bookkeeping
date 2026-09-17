import { type PostedEntry } from '@repo/contracts';
import { isAccountCode, type AccountCode } from '@repo/core/entries';
import { Panel } from '@repo/ui';
import { type ReactNode } from 'react';
import { en } from '../messages/en';

export type EntryListProps = {
  readonly entries: readonly PostedEntry[];
};

/**
 * A name for every account in the chart. Typed against the chart, so an
 * account added there fails to compile until it has copy.
 */
const ACCOUNT_NAMES: Readonly<Record<AccountCode, string>> = en.accounts;

/**
 * The wire carries an account as a string. Every listed entry passed the
 * chart on its way out of the repository, so the fallback -- the code itself --
 * is only reached if the two ever disagree.
 */
const accountName = (code: string): string => (isAccountCode(code) ? ACCOUNT_NAMES[code] : code);

/**
 * Grouped digits and no currency symbol, which is how an amount is displayed
 * (ADR-0010). English grouping, because English is the only locale that ships
 * (ADR-0008).
 */
const AMOUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * A line and the total share one grid, so their amounts align. The parts of a
 * row are separate words in its text as well as separate columns on screen:
 * the spaces between them are ignored by the grid and keep `Debit` and
 * `12,500` from running together for anything that reads the text.
 */
const ROW = 'grid grid-cols-[1fr_6rem_8rem] gap-3 py-0.5';
const AMOUNT_CELL = 'text-right tabular-nums';

/**
 * Presentation only: the order is the repository's, and the total is the
 * domain's. The section stays visible with no entries in it, because its title
 * is always rendered.
 */
export function EntryList({ entries }: EntryListProps): ReactNode {
  return (
    <Panel title={en.entryList.title}>
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-600">{en.entryList.empty}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.id} data-testid="entry" className="text-sm">
              <p className="flex gap-3">
                <time dateTime={entry.entryDate} className="tabular-nums">
                  {entry.entryDate}
                </time>{' '}
                <span className="font-medium">{entry.memo}</span>
              </p>
              <ol className="mt-1">
                {entry.lines.map((line, index) => (
                  <li key={index} data-testid="entry-line" className={ROW}>
                    <span>{accountName(line.account)}</span>{' '}
                    <span>{en.sides[line.side]}</span>{' '}
                    <span className={AMOUNT_CELL}>{AMOUNT.format(line.amount)}</span>
                  </li>
                ))}
              </ol>
              <p className={`${ROW} border-t border-neutral-200 font-medium`}>
                <span className="col-span-2">{en.entryList.total}</span>{' '}
                <span data-testid="entry-total" className={AMOUNT_CELL}>
                  {AMOUNT.format(entry.total)}
                </span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
