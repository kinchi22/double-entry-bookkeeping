import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@repo/contracts';
import { makeSearchCriteria, NO_CRITERIA } from './search-criteria';

/**
 * Pure: the rule between the criteria, and nothing about how they were typed.
 * The shape of a day is `@repo/contracts`' job, so every day here is already
 * `YYYY-MM-DD`.
 */
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

  it('says which way round the days it was given were', () => {
    const criteria = makeSearchCriteria({ from: '2026-06-30', to: '2026-06-01' });

    expect(isErr(criteria) && criteria.error.message).toContain('2026-06-30');
    expect(isErr(criteria) && criteria.error.message).toContain('2026-06-01');
  });
});
