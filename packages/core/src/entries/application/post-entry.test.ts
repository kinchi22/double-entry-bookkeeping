import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  isOk,
  ok,
  type DomainError,
  type EntryId,
  type Money,
  type Result,
} from '@repo/contracts';
import { type Entry, type EntryDraft } from '../domain/entry';
import { type EntryRepository } from '../ports/entry-repository';
import { createListEntries, type ListEntries } from './list-entries';
import { createPostEntry, type PostEntry } from './post-entry';

/**
 * A stub, not a mock: an in-memory repository that keeps what it is given and
 * lists it back. What a test asserts is what posting did to the entries a
 * reader can list, never which methods were called.
 */
function inMemoryEntries(): EntryRepository {
  const stored: Entry[] = [];
  return {
    save: (entry: Entry): Promise<Result<void, DomainError>> => {
      stored.push(entry);
      return Promise.resolve(ok(undefined));
    },
    list: (): Promise<Result<readonly Entry[], DomainError>> => Promise.resolve(ok([...stored])),
  };
}

/** A repository whose database is down: every write fails and nothing is kept. */
const unavailableEntries: EntryRepository = {
  save: () => Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
  list: () => Promise.resolve(ok([])),
};

const ENTRY_ID = '01920000-0000-7000-8000-000000000001' as EntryId;
const CREATED_AT = new Date('2026-09-15T00:30:00.000Z');

const draft = (debit: number, credit: number): EntryDraft => ({
  entryDate: '2026-09-15',
  memo: 'Office supplies',
  lines: [
    { account: 'expense', side: 'debit', amount: debit as Money },
    { account: 'cash', side: 'credit', amount: credit as Money },
  ],
});

function useCases(entries: EntryRepository): {
  postEntry: PostEntry;
  listEntries: ListEntries;
} {
  return {
    postEntry: createPostEntry({ entries, newEntryId: () => ENTRY_ID, now: () => CREATED_AT }),
    listEntries: createListEntries({ entries }),
  };
}

describe('createPostEntry', () => {
  it('stores a balanced entry, stamped with the injected id and clock, where it is listed', async () => {
    const { postEntry, listEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(draft(12500, 12500));

    expect(isOk(posted)).toBe(true);
    if (!isOk(posted)) return;
    expect(posted.value.id).toBe(ENTRY_ID);
    expect(posted.value.createdAt).toEqual(CREATED_AT);
    expect(posted.value.total).toBe(12500);

    const listed = await listEntries();
    expect(isOk(listed)).toBe(true);
    if (!isOk(listed)) return;
    expect(listed.value).toEqual([posted.value]);
  });

  it('refuses an unbalanced entry and stores nothing', async () => {
    const { postEntry, listEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(draft(12500, 12000));

    expect(isErr(posted)).toBe(true);
    if (!isErr(posted)) return;
    expect(posted.error.code).toBe('UNBALANCED');

    const listed = await listEntries();
    expect(isOk(listed)).toBe(true);
    if (!isOk(listed)) return;
    expect(listed.value).toEqual([]);
  });

  it('reports a failed save as its own result, rather than the entry it could not keep', async () => {
    const { postEntry } = useCases(unavailableEntries);

    const posted = await postEntry(draft(12500, 12500));

    expect(isErr(posted)).toBe(true);
    if (!isErr(posted)) return;
    expect(posted.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
