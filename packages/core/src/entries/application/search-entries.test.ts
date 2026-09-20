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
 * There is no case here for the criteria reaching the port. `SearchCriteria`
 * carries no criterion yet, so every value of it is the same value, and such a
 * case could only assert that one object was forwarded rather than another --
 * a mock assertion in a stub's clothes. It arrives with the first criterion,
 * where there is finally something to tell apart.
 */
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

  it('refuses to search for nobody, as unauthenticated', async () => {
    const searchEntries = createSearchEntries({
      entries: holding(() => Promise.resolve(ok([]))),
    });

    const found = await searchEntries(SIGNED_OUT, NO_CRITERIA);

    expect(isErr(found) && found.error.code).toBe('UNAUTHENTICATED');
  });
});
