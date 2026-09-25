import {
  domainError,
  err,
  ok,
  type DomainError,
  type EntryId,
  type Err,
  type Money,
  type Result,
  type Side,
} from '@repo/contracts';
import { moneyToMinorUnits, sumMoney } from '../../money/domain/money';

export const CHART_OF_ACCOUNTS = ['cash', 'payable', 'capital', 'sales', 'expense'] as const;

export type AccountCode = (typeof CHART_OF_ACCOUNTS)[number];

export function isAccountCode(value: string): value is AccountCode {
  return CHART_OF_ACCOUNTS.some((code) => code === value);
}

export const MEMO_MAX_LENGTH = 200;

export function memoLength(memo: string): number {
  // eslint-disable-next-line @typescript-eslint/no-misused-spread -- ADR-0010 counts a memo in code points, which is what spreading yields
  return [...memo].length;
}

export type EntryLine = {
  readonly account: AccountCode;
  readonly side: Side;
  readonly amount: Money;
};

export type Entry = {
  readonly id: EntryId;
  readonly entryDate: string;
  readonly memo: string;
  readonly lines: readonly EntryLine[];
  readonly total: Money;
  readonly createdAt: Date;
};

export type EntryDraft = {
  readonly entryDate: string;
  readonly memo: string;
  readonly lines: readonly {
    readonly account: string;
    readonly side: Side;
    readonly amount: Money;
  }[];
};

export type EntryStamp = {
  readonly id: EntryId;
  readonly createdAt: Date;
};

const invalid = (message: string): Err<DomainError> =>
  err(domainError('INVALID_INPUT', message));

export function makeEntry(draft: EntryDraft, stamp: EntryStamp): Result<Entry, DomainError> {
  const memo = draft.memo.trim();
  const length = memoLength(memo);
  if (length === 0 || length > MEMO_MAX_LENGTH) {
    return invalid(`A memo must be 1 to ${String(MEMO_MAX_LENGTH)} characters once trimmed.`);
  }

  const lines = checkLines(draft.lines);
  if (!lines.ok) {
    return lines;
  }

  const total = balancedTotal(lines.value);
  if (!total.ok) {
    return total;
  }

  return ok({
    id: stamp.id,
    entryDate: draft.entryDate,
    memo,
    lines: lines.value,
    total: total.value,
    createdAt: stamp.createdAt,
  });
}

function checkLines(drafts: EntryDraft['lines']): Result<readonly EntryLine[], DomainError> {
  if (drafts.length < 2) {
    return invalid('An entry needs two or more lines.');
  }

  const lines: EntryLine[] = [];
  for (const line of drafts) {
    if (!isAccountCode(line.account)) {
      return invalid(`"${line.account}" is not in the chart of accounts.`);
    }
    if (moneyToMinorUnits(line.amount) <= 0) {
      return invalid('Every line needs an amount greater than zero.');
    }
    lines.push({ account: line.account, side: line.side, amount: line.amount });
  }
  return ok(lines);
}

function balancedTotal(lines: readonly EntryLine[]): Result<Money, DomainError> {
  const debits = lines.filter((line) => line.side === 'debit').map((line) => line.amount);
  const credits = lines.filter((line) => line.side === 'credit').map((line) => line.amount);
  if (debits.length === 0 || credits.length === 0) {
    return invalid('An entry needs at least one debit and one credit.');
  }

  const debitTotal = sumMoney(debits);
  if (!debitTotal.ok) {
    return invalid('The debits add up to more than an amount can hold.');
  }
  const creditTotal = sumMoney(credits);
  if (!creditTotal.ok) {
    return invalid('The credits add up to more than an amount can hold.');
  }

  if (debitTotal.value !== creditTotal.value) {
    return err(domainError('UNBALANCED', 'The debits and the credits differ.'));
  }
  return ok(debitTotal.value);
}
