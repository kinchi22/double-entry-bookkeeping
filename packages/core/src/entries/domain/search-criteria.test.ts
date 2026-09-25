import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@repo/contracts';
import { MEMO_MAX_LENGTH } from './entry';
import { makeSearchCriteria, NO_CRITERIA } from './search-criteria';

describe('makeSearchCriteria', () => {
  it('narrows by nothing when it is given nothing', () => {
    const criteria = makeSearchCriteria({});

    expect(isOk(criteria)).toBe(true);
    expect(isOk(criteria) && criteria.value).toEqual(NO_CRITERIA);
  });

  it('keeps a range whose first day is given alone', () => {
    const criteria = makeSearchCriteria({ from: '2026-06-01' });

    expect(isOk(criteria) && criteria.value).toEqual({ from: '2026-06-01' });
  });

  it('keeps a range whose last day is given alone', () => {
    const criteria = makeSearchCriteria({ to: '2026-06-30' });

    expect(isOk(criteria) && criteria.value).toEqual({ to: '2026-06-30' });
  });

  it('keeps both ends of a range that is the right way round', () => {
    const criteria = makeSearchCriteria({ from: '2026-06-01', to: '2026-06-30' });

    expect(isOk(criteria) && criteria.value).toEqual({ from: '2026-06-01', to: '2026-06-30' });
  });

  it('accepts a range that starts and ends on the same day', () => {
    const criteria = makeSearchCriteria({ from: '2026-06-15', to: '2026-06-15' });

    expect(isOk(criteria) && criteria.value).toEqual({ from: '2026-06-15', to: '2026-06-15' });
  });

  it('reads an absent end as no criterion rather than as a criterion of nothing', () => {
    const criteria = makeSearchCriteria({ from: undefined, to: undefined });

    expect(isOk(criteria) && Object.keys(criteria.value)).toEqual([]);
  });

  it.each([
    ['by a day', '2026-06-02', '2026-06-01'],
    ['by a month', '2026-07-01', '2026-06-01'],
    ['by a year', '2027-01-01', '2026-01-01'],
  ])('refuses a range that ends before it starts, %s', (_case, from, to) => {
    const criteria = makeSearchCriteria({ from, to });

    expect(isErr(criteria)).toBe(true);
    expect(isErr(criteria) && criteria.error.code).toBe('INVALID_INPUT');
  });

  it('keeps an Account that is in the chart of accounts', () => {
    const criteria = makeSearchCriteria({ account: 'cash' });

    expect(isOk(criteria) && criteria.value).toEqual({ account: 'cash' });
  });

  it('keeps the Account beside a range, so the two narrow together', () => {
    const criteria = makeSearchCriteria({ from: '2026-06-01', to: '2026-06-30', account: 'sales' });

    expect(isOk(criteria) && criteria.value).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
      account: 'sales',
    });
  });

  it('reads an absent Account as no criterion rather than as a criterion of nothing', () => {
    const criteria = makeSearchCriteria({ account: undefined });

    expect(isOk(criteria) && Object.keys(criteria.value)).toEqual([]);
  });

  it.each([
    ['one no chart has', 'petty-cash'],
    ['one in the wrong case', 'Cash'],
    ['nothing at all', ''],
  ])('refuses an Account outside the chart of accounts: %s', (_case, account) => {
    const criteria = makeSearchCriteria({ account });

    expect(isErr(criteria)).toBe(true);
    expect(isErr(criteria) && criteria.error.code).toBe('INVALID_INPUT');
  });

  it('says which Account it was asked for', () => {
    const criteria = makeSearchCriteria({ account: 'petty-cash' });

    expect(isErr(criteria) && criteria.error.message).toContain('petty-cash');
  });

  it('refuses an Account outside the chart even when the range is a good one', () => {
    const criteria = makeSearchCriteria({ from: '2026-06-01', to: '2026-06-30', account: 'bank' });

    expect(isErr(criteria) && criteria.error.message).toContain('bank');
  });

  it('says which way round the days it was given were', () => {
    const criteria = makeSearchCriteria({ from: '2026-06-30', to: '2026-06-01' });

    expect(isErr(criteria) && criteria.error.message).toContain('2026-06-30');
    expect(isErr(criteria) && criteria.error.message).toContain('2026-06-01');
  });

  it('keeps a memo term to look for', () => {
    const criteria = makeSearchCriteria({ memo: 'coffee' });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: 'coffee' });
  });

  it('keeps the memo term beside the range and the Account, so all three narrow together', () => {
    const criteria = makeSearchCriteria({
      from: '2026-06-01',
      to: '2026-06-30',
      account: 'cash',
      memo: 'rent',
    });

    expect(isOk(criteria) && criteria.value).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
      account: 'cash',
      memo: 'rent',
    });
  });

  it('trims a term, so the space either side of a typed word is not searched for', () => {
    const criteria = makeSearchCriteria({ memo: '  coffee  ' });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: 'coffee' });
  });

  it('keeps the space inside a term, which is part of what was typed', () => {
    const criteria = makeSearchCriteria({ memo: ' coffee beans ' });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: 'coffee beans' });
  });

  it('reads an absent memo term as no criterion rather than as a criterion of nothing', () => {
    const criteria = makeSearchCriteria({ memo: undefined });

    expect(isOk(criteria) && Object.keys(criteria.value)).toEqual([]);
  });

  it.each([
    ['nothing at all', ''],
    ['a single space', ' '],
    ['several spaces', '     '],
    ['a tab and a newline', '\t\n'],
  ])('reads a term of only whitespace as no criterion: %s', (_case, memo) => {
    const criteria = makeSearchCriteria({ memo });

    expect(isOk(criteria)).toBe(true);
    expect(isOk(criteria) && Object.keys(criteria.value)).toEqual([]);
  });

  it('drops a whitespace-only term without dropping the criteria beside it', () => {
    const criteria = makeSearchCriteria({ from: '2026-06-01', account: 'cash', memo: '  ' });

    expect(isOk(criteria) && criteria.value).toEqual({ from: '2026-06-01', account: 'cash' });
  });

  it('keeps a term as long as a memo can be, which is a term that can still match', () => {
    const memo = 'a'.repeat(MEMO_MAX_LENGTH);

    const criteria = makeSearchCriteria({ memo });

    expect(isOk(criteria) && criteria.value).toEqual({ memo });
  });

  it('refuses a term longer than a memo can be, since nothing that long can match', () => {
    const criteria = makeSearchCriteria({ memo: 'a'.repeat(MEMO_MAX_LENGTH + 1) });

    expect(isErr(criteria)).toBe(true);
    expect(isErr(criteria) && criteria.error.code).toBe('INVALID_INPUT');
  });

  it('says how long a term may be when it refuses one', () => {
    const criteria = makeSearchCriteria({ memo: 'a'.repeat(MEMO_MAX_LENGTH + 1) });

    expect(isErr(criteria) && criteria.error.message).toContain(String(MEMO_MAX_LENGTH));
  });

  it('measures a term the way a memo is measured, in code points', () => {
    const grinning = String.fromCodePoint(0x1f600);

    const criteria = makeSearchCriteria({ memo: grinning.repeat(MEMO_MAX_LENGTH) });

    expect(isOk(criteria)).toBe(true);
    expect(isErr(makeSearchCriteria({ memo: grinning.repeat(MEMO_MAX_LENGTH + 1) }))).toBe(true);
  });

  it('measures the term it kept, so trailing space cannot push one over the cap', () => {
    const criteria = makeSearchCriteria({ memo: `${'a'.repeat(MEMO_MAX_LENGTH)}   ` });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: 'a'.repeat(MEMO_MAX_LENGTH) });
  });

  it('keeps a wildcard in a term, which is a character to look for like any other', () => {
    const criteria = makeSearchCriteria({ memo: '100% off_hours' });

    expect(isOk(criteria) && criteria.value).toEqual({ memo: '100% off_hours' });
  });
});
