import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  isOk,
  ok,
  type EntryId,
  type Money,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT } from '../../auth/domain/auth-context';
import { makeEntry, type Entry } from '../domain/entry';
import { NO_CRITERIA } from '../domain/search-criteria';
import { type EntryRepository } from '../ports/entry-repository';
import { createSearchEntries } from './search-entries';

const made = makeEntry(
  {
    entryDate: '2026-09-15',
    memo: 'Office supplies',
    lines: [
      { account: 'expense', side: 'debit', amount: 12500 as Money },
      { account: 'cash', side: 'credit', amount: 12500 as Money },
    ],
  },
  {
    id: '01920000-0000-7000-8000-000000000001' as EntryId,
    createdAt: new Date('2026-09-15T00:30:00.000Z'),
  },
);

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;

/** A stub repository that answers `search` with a fixed result. */
const holding = (searched: EntryRepository['search']): EntryRepository => ({
  save: () => Promise.resolve(ok(undefined)),
  search: searched,
});

/**
 * A stub repository that answers with the entries the criteria it was searched
 * with match, as a repository does: an absent criterion matches everything, and
 * those present combine with `and`. It is the port doing what a port does, not
 * a spy: what each case asserts is which entries came back, never that a call
 * was made.
 */
const holdingMatching = (held: readonly Entry[]): EntryRepository =>
  holding((_userId, criteria) =>
    Promise.resolve(
      ok(
        held.filter(
          (entry) =>
            (criteria.from === undefined || entry.entryDate >= criteria.from) &&
            (criteria.to === undefined || entry.entryDate <= criteria.to) &&
            (criteria.account === undefined ||
              entry.lines.some((line) => line.account === criteria.account)),
        ),
      ),
    ),
  );

describe('createSearchEntries', () => {
  it('answers with what the repository holds, in the order it holds it', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const later: Entry = { ...made.value, entryDate: '2026-09-16' };
    const searchEntries = createSearchEntries({
      entries: holding(() => Promise.resolve(ok([later, made.value]))),
    });

    const found = await searchEntries({ userId: ADA }, NO_CRITERIA);

    expect(isOk(found)).toBe(true);
    if (!isOk(found)) return;
    expect(found.value).toEqual([later, made.value]);
  });

  it('passes a repository failure through as the result', async () => {
    const searchEntries = createSearchEntries({
      entries: holding(() =>
        Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
      ),
    });

    const found = await searchEntries({ userId: ADA }, NO_CRITERIA);

    expect(isErr(found)).toBe(true);
    if (!isErr(found)) return;
    expect(found.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it('searches the books of the signed-in User, and nobody else', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const own = made.value;
    const searchEntries = createSearchEntries({
      entries: holding((userId) => Promise.resolve(ok(userId === ADA ? [own] : []))),
    });

    const found = await searchEntries({ userId: ADA }, NO_CRITERIA);

    expect(isOk(found) && found.value).toEqual([own]);
  });

  it('searches with the criteria it was given, so a day range narrows the answer', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const september = made.value;
    const october: Entry = { ...september, entryDate: '2026-10-04' };
    const searchEntries = createSearchEntries({ entries: holdingMatching([october, september]) });

    const found = await searchEntries({ userId: ADA }, { from: '2026-10-01' });

    expect(isOk(found) && found.value).toEqual([october]);
  });

  it('searches with each end of a range on its own, and with neither', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const september = made.value;
    const october: Entry = { ...september, entryDate: '2026-10-04' };
    const searchEntries = createSearchEntries({ entries: holdingMatching([october, september]) });

    const upTo = await searchEntries({ userId: ADA }, { to: '2026-09-30' });
    const between = await searchEntries(
      { userId: ADA },
      { from: '2026-10-01', to: '2026-10-31' },
    );
    const everything = await searchEntries({ userId: ADA }, NO_CRITERIA);

    expect(isOk(upTo) && upTo.value).toEqual([september]);
    expect(isOk(between) && between.value).toEqual([october]);
    expect(isOk(everything) && everything.value).toEqual([october, september]);
  });

  it('searches with the Account it was given, so it narrows the answer too', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const touchingCash = made.value;
    const onAccount: Entry = {
      ...touchingCash,
      lines: [
        { account: 'expense', side: 'debit', amount: 12500 as Money },
        { account: 'payable', side: 'credit', amount: 12500 as Money },
      ],
    };
    const searchEntries = createSearchEntries({
      entries: holdingMatching([onAccount, touchingCash]),
    });

    const found = await searchEntries({ userId: ADA }, { account: 'cash' });

    expect(isOk(found) && found.value).toEqual([touchingCash]);
  });

  it('narrows by the Account and the range together, with `and`', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const september = made.value;
    const october: Entry = { ...september, entryDate: '2026-10-04' };
    const searchEntries = createSearchEntries({ entries: holdingMatching([october, september]) });

    const both = await searchEntries({ userId: ADA }, { from: '2026-10-01', account: 'cash' });
    const otherAccount = await searchEntries(
      { userId: ADA },
      { from: '2026-10-01', account: 'sales' },
    );

    expect(isOk(both) && both.value).toEqual([october]);
    expect(isOk(otherAccount) && otherAccount.value).toEqual([]);
  });

  it('refuses an Account outside the chart of accounts, and searches nothing', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const searchEntries = createSearchEntries({ entries: holdingMatching([made.value]) });

    const found = await searchEntries({ userId: ADA }, { account: 'petty-cash' });

    expect(isErr(found)).toBe(true);
    expect(isErr(found) && found.error.code).toBe('INVALID_INPUT');
  });

  it('refuses a range that ends before it starts, and searches nothing', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const searchEntries = createSearchEntries({ entries: holdingMatching([made.value]) });

    const found = await searchEntries(
      { userId: ADA },
      { from: '2026-09-30', to: '2026-09-01' },
    );

    expect(isErr(found)).toBe(true);
    expect(isErr(found) && found.error.code).toBe('INVALID_INPUT');
  });

  it('refuses to search for nobody, as unauthenticated', async () => {
    const searchEntries = createSearchEntries({
      entries: holding(() => Promise.resolve(ok([]))),
    });

    const found = await searchEntries(SIGNED_OUT, NO_CRITERIA);

    expect(isErr(found) && found.error.code).toBe('UNAUTHENTICATED');
  });
});
