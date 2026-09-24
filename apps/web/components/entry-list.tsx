import { type PostedEntry } from '@repo/contracts';
import { isAccountCode, type AccountCode } from '@repo/core/entries';
import { Panel } from '@repo/ui';
import { type ReactNode } from 'react';
import { en } from '../messages/en';

export type EntryListProps = {
  readonly entries: readonly PostedEntry[];
};

const ACCOUNT_NAMES: Readonly<Record<AccountCode, string>> = en.accounts;

const accountName = (code: string): string => (isAccountCode(code) ? ACCOUNT_NAMES[code] : code);

const AMOUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const ROW = 'grid grid-cols-[1fr_6rem_8rem] gap-3 py-0.5';
const AMOUNT_CELL = 'text-right tabular-nums';

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
