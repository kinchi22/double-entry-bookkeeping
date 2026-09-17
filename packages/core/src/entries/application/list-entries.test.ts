import { describe, expect, it } from 'vitest';
import { domainError, err, isErr, isOk, ok, type EntryId, type Money } from '@repo/contracts';
import { makeEntry, type Entry } from '../domain/entry';
import { type EntryRepository } from '../ports/entry-repository';
import { createListEntries } from './list-entries';

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

/** A stub repository that answers `list` with a fixed result. */
const holding = (listed: EntryRepository['list']): EntryRepository => ({
  save: () => Promise.resolve(ok(undefined)),
  list: listed,
});

describe('createListEntries', () => {
  it('lists what the repository holds, in the order it holds it', async () => {
    expect(isOk(made)).toBe(true);
    if (!isOk(made)) return;
    const later: Entry = { ...made.value, entryDate: '2026-09-16' };
    const listEntries = createListEntries({
      entries: holding(() => Promise.resolve(ok([later, made.value]))),
    });

    const listed = await listEntries();

    expect(isOk(listed)).toBe(true);
    if (!isOk(listed)) return;
    expect(listed.value).toEqual([later, made.value]);
  });

  it('passes a repository failure through as the result', async () => {
    const listEntries = createListEntries({
      entries: holding(() =>
        Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
      ),
    });

    const listed = await listEntries();

    expect(isErr(listed)).toBe(true);
    if (!isErr(listed)) return;
    expect(listed.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
