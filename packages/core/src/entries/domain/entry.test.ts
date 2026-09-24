import { describe, expect, it } from 'vitest';
import { isErr, isOk, type DomainErrorCode, type EntryId, type Money, type Side } from '@repo/contracts';
import { MONEY_ZERO, money } from '../../money/domain/money';
import { isAccountCode, makeEntry, type EntryDraft } from './entry';

const amount = (minorUnits: number): Money => {
  const result = money(minorUnits);
  expect(isOk(result), `test setup used an invalid amount: ${String(minorUnits)}`).toBe(true);
  return isOk(result) ? result.value : MONEY_ZERO;
};

const line = (account: string, side: Side, minorUnits: number): EntryDraft['lines'][number] => ({
  account,
  side,
  amount: amount(minorUnits),
});

const STAMP = {
  id: '01920000-0000-7000-8000-000000000001' as EntryId,
  createdAt: new Date('2026-09-15T00:30:00.000Z'),
};

const OFFICE_SUPPLIES: EntryDraft = {
  entryDate: '2026-09-15',
  memo: 'Office supplies',
  lines: [line('expense', 'debit', 12500), line('cash', 'credit', 12500)],
};

const expectRefused = (
  draft: EntryDraft,
  code: DomainErrorCode,
  reason: string,
): void => {
  const result = makeEntry(draft, STAMP);

  expect(isErr(result)).toBe(true);
  if (!isErr(result)) return;
  expect(result.error.code).toBe(code);
  expect(result.error.message).toContain(reason);
};

const withLines = (...lines: EntryDraft['lines']): EntryDraft => ({ ...OFFICE_SUPPLIES, lines });

describe('makeEntry', () => {
  it('builds a balanced entry, stamped, with its lines in order and its total', () => {
    const result = makeEntry(OFFICE_SUPPLIES, STAMP);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value).toEqual({
      id: STAMP.id,
      entryDate: '2026-09-15',
      memo: 'Office supplies',
      lines: [
        { account: 'expense', side: 'debit', amount: 12500 },
        { account: 'cash', side: 'credit', amount: 12500 },
      ],
      total: 12500,
      createdAt: STAMP.createdAt,
    });
  });

  it('totals the debits, not whichever line comes first', () => {
    const result = makeEntry(
      withLines(
        line('expense', 'debit', 10000),
        line('expense', 'debit', 2500),
        line('cash', 'credit', 12500),
      ),
      STAMP,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.total).toBe(12500);
  });

  it('balances a credit split across lines, and lets an account appear twice', () => {
    const result = makeEntry(
      withLines(
        line('cash', 'credit', 5000),
        line('expense', 'debit', 12500),
        line('cash', 'credit', 7500),
      ),
      STAMP,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.total).toBe(12500);
    expect(result.value.lines.map((entered) => entered.amount)).toEqual([5000, 12500, 7500]);
  });

  it('refuses an entry whose debits and credits differ, as an imbalance', () => {
    expectRefused(
      withLines(line('expense', 'debit', 12500), line('cash', 'credit', 12000)),
      'UNBALANCED',
      'differ',
    );
  });

  it('refuses an imbalance on the credit side too', () => {
    expectRefused(
      withLines(line('expense', 'debit', 12000), line('cash', 'credit', 12500)),
      'UNBALANCED',
      'differ',
    );
  });

  it.each(['cash', 'payable', 'capital', 'sales', 'expense'])(
    'accepts %s, from the chart of accounts',
    (account) => {
      const result = makeEntry(
        withLines(line(account, 'debit', 100), line(account, 'credit', 100)),
        STAMP,
      );

      expect(isOk(result)).toBe(true);
    },
  );

  it('refuses an account that is not in the chart', () => {
    expectRefused(
      withLines(line('expense', 'debit', 100), line('bank', 'credit', 100)),
      'INVALID_INPUT',
      'chart of accounts',
    );
  });

  it('refuses fewer than two lines', () => {
    expectRefused(withLines(line('expense', 'debit', 100)), 'INVALID_INPUT', 'two or more lines');
    expectRefused(withLines(), 'INVALID_INPUT', 'two or more lines');
  });

  it('refuses lines that are all debits or all credits, even when there are two', () => {
    expectRefused(
      withLines(line('expense', 'debit', 100), line('cash', 'debit', 100)),
      'INVALID_INPUT',
      'one debit and one credit',
    );
    expectRefused(
      withLines(line('expense', 'credit', 100), line('cash', 'credit', 100)),
      'INVALID_INPUT',
      'one debit and one credit',
    );
  });

  it('refuses a zero amount, even when the entry would balance', () => {
    expectRefused(
      withLines(line('expense', 'debit', 0), line('cash', 'credit', 0)),
      'INVALID_INPUT',
      'greater than zero',
    );
  });

  it('refuses a negative amount, because the side carries the direction', () => {
    expectRefused(
      withLines(line('expense', 'debit', -100), line('cash', 'credit', -100)),
      'INVALID_INPUT',
      'greater than zero',
    );
  });

  it('refuses debits too large to add up exactly, rather than rounding them', () => {
    expectRefused(
      withLines(
        line('expense', 'debit', Number.MAX_SAFE_INTEGER),
        line('expense', 'debit', 1),
        line('cash', 'credit', 1),
      ),
      'INVALID_INPUT',
      'debits add up',
    );
  });

  it('refuses credits too large to add up exactly, rather than rounding them', () => {
    expectRefused(
      withLines(
        line('expense', 'debit', 1),
        line('cash', 'credit', Number.MAX_SAFE_INTEGER),
        line('cash', 'credit', 1),
      ),
      'INVALID_INPUT',
      'credits add up',
    );
  });

  it('accepts the largest amount that still adds up exactly', () => {
    const result = makeEntry(
      withLines(
        line('expense', 'debit', Number.MAX_SAFE_INTEGER),
        line('cash', 'credit', Number.MAX_SAFE_INTEGER),
      ),
      STAMP,
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.total).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('stores the memo trimmed', () => {
    const result = makeEntry({ ...OFFICE_SUPPLIES, memo: '  Office supplies \n' }, STAMP);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.memo).toBe('Office supplies');
  });

  it('refuses a memo that is empty once trimmed', () => {
    expectRefused({ ...OFFICE_SUPPLIES, memo: '' }, 'INVALID_INPUT', 'memo');
    expectRefused({ ...OFFICE_SUPPLIES, memo: ' \t\n ' }, 'INVALID_INPUT', 'memo');
  });

  it('accepts a memo of 200 characters, and refuses 201', () => {
    expect(isOk(makeEntry({ ...OFFICE_SUPPLIES, memo: 'm'.repeat(200) }, STAMP))).toBe(true);
    expectRefused({ ...OFFICE_SUPPLIES, memo: 'm'.repeat(201) }, 'INVALID_INPUT', '1 to 200');
  });

  it('counts a memo in code points, so 200 emoji fit though they are 400 UTF-16 units', () => {
    const grinning = String.fromCodePoint(0x1f600);

    expect(isOk(makeEntry({ ...OFFICE_SUPPLIES, memo: grinning.repeat(200) }, STAMP))).toBe(true);
    expectRefused(
      { ...OFFICE_SUPPLIES, memo: grinning.repeat(201) },
      'INVALID_INPUT',
      '1 to 200',
    );
  });

  it('counts the limit after trimming', () => {
    const result = makeEntry({ ...OFFICE_SUPPLIES, memo: ` ${'m'.repeat(200)} ` }, STAMP);

    expect(isOk(result)).toBe(true);
  });

  it('accepts a day in the future, which is still a day', () => {
    const result = makeEntry({ ...OFFICE_SUPPLIES, entryDate: '2126-01-01' }, STAMP);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.entryDate).toBe('2126-01-01');
  });
});

describe('isAccountCode', () => {
  it('knows a code from the chart', () => {
    expect(isAccountCode('payable')).toBe(true);
  });

  it('matches the code exactly, case included', () => {
    expect(isAccountCode('Cash')).toBe(false);
    expect(isAccountCode('')).toBe(false);
  });
});
