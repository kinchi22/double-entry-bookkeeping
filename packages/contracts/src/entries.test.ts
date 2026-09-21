import { describe, expect, it } from 'vitest';
import {
  entryDateSchema,
  entryIdSchema,
  entryLineSchema,
  parseEntryForm,
  parseSearchQuery,
  postEntryInputSchema,
  postedEntrySchema,
  searchCriteriaSchema,
  sideSchema,
  toPostedEntry,
  type EntryId,
  type SubmittedFields,
} from './entries';
import { type Money } from './money';
import { isErr, isOk } from './result';

const ENTRY_ID = '01920000-0000-7000-8000-000000000001' as EntryId;
const CREATED_AT = new Date('2026-09-15T09:30:00+09:00');

describe('entryIdSchema', () => {
  it('accepts a uuid v7', () => {
    expect(entryIdSchema.parse(ENTRY_ID)).toBe(ENTRY_ID);
  });

  it('rejects a uuid v4, which does not sort by creation time', () => {
    expect(entryIdSchema.safeParse('9b2f6d1e-3c4a-4f5b-8a6d-7e8f9a0b1c2d').success).toBe(false);
  });
});

describe('sideSchema', () => {
  it('accepts both directions a line can take', () => {
    expect(sideSchema.parse('debit')).toBe('debit');
    expect(sideSchema.parse('credit')).toBe('credit');
  });

  it('rejects anything else, so a sign cannot stand in for a side', () => {
    expect(sideSchema.safeParse('-').success).toBe(false);
  });
});

describe('entryDateSchema', () => {
  it('accepts a calendar day', () => {
    expect(entryDateSchema.parse('2026-09-15')).toBe('2026-09-15');
  });

  it('rejects an instant, because a day has no time in it', () => {
    expect(entryDateSchema.safeParse('2026-09-15T00:00:00Z').success).toBe(false);
  });

  it('rejects a day no calendar has', () => {
    expect(entryDateSchema.safeParse('2026-02-30').success).toBe(false);
  });
});

describe('entryLineSchema', () => {
  it('carries an account, a side and an amount', () => {
    expect(entryLineSchema.parse({ account: 'cash', side: 'credit', amount: 12500 })).toEqual({
      account: 'cash',
      side: 'credit',
      amount: 12500,
    });
  });

  it('refuses a line with no side, or with an amount that is not whole', () => {
    expect(entryLineSchema.safeParse({ account: 'cash', amount: 12500 }).success).toBe(false);
    expect(
      entryLineSchema.safeParse({ account: 'cash', side: 'credit', amount: 12.5 }).success,
    ).toBe(false);
  });
});

describe('postEntryInputSchema', () => {
  const input = {
    entryDate: '2026-09-15',
    memo: 'Office supplies',
    lines: [{ account: 'cash', side: 'credit', amount: 12500 }],
  };

  it('carries a day, a memo and the lines', () => {
    expect(postEntryInputSchema.parse(input)).toEqual(input);
  });

  it('refuses an input missing its lines or its day', () => {
    expect(postEntryInputSchema.safeParse({ ...input, lines: undefined }).success).toBe(false);
    expect(postEntryInputSchema.safeParse({ ...input, entryDate: undefined }).success).toBe(false);
  });
});

describe('toPostedEntry', () => {
  const entry = {
    id: ENTRY_ID,
    entryDate: '2026-09-15',
    memo: 'Office supplies',
    lines: [
      { account: 'expense', side: 'debit', amount: 12500 as Money, lineNumber: 1 },
      { account: 'cash', side: 'credit', amount: 12500 as Money, lineNumber: 2 },
    ],
    total: 12500 as Money,
    createdAt: CREATED_AT,
  } as const;

  it('carries the entry field by field, and its lines in order', () => {
    expect(toPostedEntry(entry)).toEqual({
      id: ENTRY_ID,
      entryDate: '2026-09-15',
      memo: 'Office supplies',
      lines: [
        { account: 'expense', side: 'debit', amount: 12500 },
        { account: 'cash', side: 'credit', amount: 12500 },
      ],
      total: 12500,
      createdAt: '2026-09-15T00:30:00.000Z',
    });
  });

  it('produces a value the contract itself accepts', () => {
    expect(postedEntrySchema.safeParse(toPostedEntry(entry)).success).toBe(true);
  });

  it('is a contract that refuses an entry missing its total or its instant', () => {
    const posted = toPostedEntry(entry);

    expect(postedEntrySchema.safeParse({ ...posted, total: undefined }).success).toBe(false);
    expect(postedEntrySchema.safeParse({ ...posted, createdAt: undefined }).success).toBe(false);
  });
});

type Fields = Readonly<Record<string, string | readonly string[]>>;

/**
 * Submitted fields that answer the way `FormData` does: `get` gives the first
 * value or `null`, `getAll` gives every value in order. This package has no DOM
 * or Node types, so `FormData` itself is checked against `SubmittedFields` where
 * the Server Action passes one.
 */
function submitted(fields: Fields): SubmittedFields {
  const values = (name: string): readonly string[] => {
    const value = fields[name];
    if (value === undefined) return [];
    return typeof value === 'string' ? [value] : value;
  };
  return { get: (name) => values(name)[0] ?? null, getAll: values };
}

const BALANCED: Fields = {
  entryDate: '2026-09-15',
  memo: 'Office supplies',
  account: ['expense', 'cash'],
  side: ['debit', 'credit'],
  amount: ['12500', '12500'],
};

const expectRefused = (fields: Fields): void => {
  const result = parseEntryForm(submitted(fields));

  expect(isErr(result)).toBe(true);
  if (!isErr(result)) return;
  expect(result.error.code).toBe('INVALID_INPUT');
  expect(result.error.message).toContain('entry form');
};

describe('parseEntryForm', () => {
  it('reads the day, the memo, and one line per position', () => {
    const result = parseEntryForm(submitted(BALANCED));

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value).toEqual({
      entryDate: '2026-09-15',
      memo: 'Office supplies',
      lines: [
        { account: 'expense', side: 'debit', amount: 12500 },
        { account: 'cash', side: 'credit', amount: 12500 },
      ],
    });
  });

  it('leaves the rules to the domain: an unbalanced, unknown-account form still parses', () => {
    const result = parseEntryForm(
      submitted({ ...BALANCED, account: ['nowhere', 'cash'], amount: ['12500', '12000'] }),
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.lines.map((line) => [line.account, line.amount])).toEqual([
      ['nowhere', 12500],
      ['cash', 12000],
    ]);
  });

  it('reads leading zeros as the number they spell', () => {
    const result = parseEntryForm(submitted({ ...BALANCED, amount: ['012500', '12500'] }));

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.lines[0]?.amount).toBe(12500);
  });

  it('refuses a line missing one of its fields, rather than dropping it', () => {
    expectRefused({ ...BALANCED, side: ['debit'] });
    expectRefused({ ...BALANCED, account: ['expense'] });
    expectRefused({ ...BALANCED, amount: ['12500'] });
  });

  it('refuses a form with no date or no memo', () => {
    expectRefused({ ...BALANCED, entryDate: [] });
    expectRefused({ ...BALANCED, memo: [] });
  });

  it('refuses a date that is not a calendar day', () => {
    expectRefused({ ...BALANCED, entryDate: '15/09/2026' });
  });

  it('refuses a side that is not debit or credit', () => {
    expectRefused({ ...BALANCED, side: ['debit', 'minus'] });
  });

  it.each([
    ['grouped', '12,500'],
    ['decimal', '12500.00'],
    ['signed', '-12500'],
    ['led by something else', 'x12500'],
    ['trailed by something else', '12500x'],
    ['blank', ''],
    ['past the safe integer range', '9007199254740992'],
  ])('refuses an amount that is %s', (_, amount) => {
    expectRefused({ ...BALANCED, amount: [amount, '12500'] });
  });
});

describe('searchCriteriaSchema', () => {
  it('accepts a range of calendar days', () => {
    expect(searchCriteriaSchema.parse({ from: '2026-06-01', to: '2026-06-30' })).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    });
  });

  it('accepts either end of a range on its own, and neither', () => {
    expect(searchCriteriaSchema.safeParse({ from: '2026-06-01' }).success).toBe(true);
    expect(searchCriteriaSchema.safeParse({ to: '2026-06-30' }).success).toBe(true);
    expect(searchCriteriaSchema.safeParse({}).success).toBe(true);
  });

  it('rejects an end that is not a calendar day', () => {
    expect(searchCriteriaSchema.safeParse({ from: '01/06/2026' }).success).toBe(false);
    expect(searchCriteriaSchema.safeParse({ to: '2026-06-31' }).success).toBe(false);
  });

  it('leaves the rule between the ends to the domain: a reversed range parses', () => {
    expect(searchCriteriaSchema.safeParse({ from: '2026-06-30', to: '2026-06-01' }).success).toBe(
      true,
    );
  });
});

describe('parseSearchQuery', () => {
  it('reads both ends of a range out of the query', () => {
    const criteria = parseSearchQuery({ from: '2026-06-01', to: '2026-06-30' });

    expect(isOk(criteria)).toBe(true);
    if (!isOk(criteria)) return;
    expect(criteria.value).toEqual({ from: '2026-06-01', to: '2026-06-30' });
  });

  it('reads a query with no parameters as no criterion at all', () => {
    const criteria = parseSearchQuery({});

    expect(isOk(criteria)).toBe(true);
    if (!isOk(criteria)) return;
    expect(criteria.value.from).toBeUndefined();
    expect(criteria.value.to).toBeUndefined();
  });

  it('reads an empty parameter as an absent criterion, not as an empty day', () => {
    const criteria = parseSearchQuery({ from: '', to: '2026-06-30' });

    expect(isOk(criteria)).toBe(true);
    if (!isOk(criteria)) return;
    expect(criteria.value.from).toBeUndefined();
    expect(criteria.value.to).toBe('2026-06-30');
  });

  it('ignores a parameter that is no criterion of this search', () => {
    const criteria = parseSearchQuery({ from: '2026-06-01', page: '2' });

    expect(isOk(criteria) && criteria.value).toEqual({ from: '2026-06-01' });
  });

  it.each([
    ['a day in another order', { from: '01/06/2026' }],
    ['a day no calendar has', { to: '2026-02-30' }],
    ['an instant rather than a day', { from: '2026-06-01T00:00:00Z' }],
    ['a word', { to: 'june' }],
  ])('refuses %s rather than searching without it', (_case, query) => {
    const criteria = parseSearchQuery(query);

    expect(isErr(criteria)).toBe(true);
    if (!isErr(criteria)) return;
    expect(criteria.error.code).toBe('INVALID_INPUT');
    expect(criteria.error.message).toContain('search criteria');
  });

  it('refuses a criterion given twice, which arrives as a list', () => {
    const criteria = parseSearchQuery({ from: ['2026-06-01', '2026-07-01'] });

    expect(isErr(criteria) && criteria.error.code).toBe('INVALID_INPUT');
  });
});
