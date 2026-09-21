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

/**
 * An entry: a calendar day, a memo, and two or more lines whose debits balance
 * its credits. ADR-0010 is the model; this file is where its rules are decided,
 * and the only place. The database stores what this accepted and checks no
 * rule of its own.
 *
 * Everything here is pure: the id and the instant an entry is stamped with are
 * arguments, because generating either is an effect.
 */

/**
 * The accounts a line may name, one per type: asset, liability, equity, revenue,
 * expense. A constant until ADR-0015 makes accounts data.
 */
export const CHART_OF_ACCOUNTS = ['cash', 'payable', 'capital', 'sales', 'expense'] as const;

export type AccountCode = (typeof CHART_OF_ACCOUNTS)[number];

export function isAccountCode(value: string): value is AccountCode {
  return CHART_OF_ACCOUNTS.some((code) => code === value);
}

/** Counted in code points once trimmed, so an emoji counts as one. */
export const MEMO_MAX_LENGTH = 200;

/**
 * How long a memo is, and the one place that decides what a character is here.
 *
 * ADR-0010 limits a memo in code points, which is what spreading a string
 * yields. The rule wants graphemes; a family emoji is then one character here
 * and several there, and the ADR chose the count that needs no Intl data.
 *
 * A memo term is measured with this too, so the cap on a search term is the cap
 * on the thing it could match, rather than a second count that could drift from
 * it.
 */
export function memoLength(memo: string): number {
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  return [...memo].length;
}

export type EntryLine = {
  readonly account: AccountCode;
  readonly side: Side;
  readonly amount: Money;
};

export type Entry = {
  readonly id: EntryId;
  /** `YYYY-MM-DD`, as the contract parsed it. Any day, future days included. */
  readonly entryDate: string;
  readonly memo: string;
  /** In the order they were entered. */
  readonly lines: readonly EntryLine[];
  /** The sum of the debits, which is the sum of the credits. */
  readonly total: Money;
  readonly createdAt: Date;
};

/** An entry as it was asked for, before any rule has been applied to it. */
export type EntryDraft = {
  readonly entryDate: string;
  readonly memo: string;
  readonly lines: readonly {
    readonly account: string;
    readonly side: Side;
    readonly amount: Money;
  }[];
};

/** What the caller supplies because it is an effect: the id and the instant. */
export type EntryStamp = {
  readonly id: EntryId;
  readonly createdAt: Date;
};

const invalid = (message: string): Err<DomainError> =>
  err(domainError('INVALID_INPUT', message));

/**
 * Applies every rule an entry has, and returns the entry or the first rule it
 * breaks. Reading a stored entry goes through here too, so a row written around
 * the app that breaks a rule is reported rather than listed.
 */
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
    // The side carries the direction, so an amount is never negative or zero.
    if (moneyToMinorUnits(line.amount) <= 0) {
      return invalid('Every line needs an amount greater than zero.');
    }
    lines.push({ account: line.account, side: line.side, amount: line.amount });
  }
  return ok(lines);
}

/**
 * Each side is summed through `sumMoney`, so a total too large to hold exactly
 * is an error rather than a rounded number that happens to balance.
 */
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
