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
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry, type EntryDraft } from '../domain/entry';
import { NO_CRITERIA } from '../domain/search-criteria';
import { type EntryRepository } from '../ports/entry-repository';
import { createSearchEntries, type SearchEntries } from './search-entries';
import { createPostEntry, type PostEntry } from './post-entry';

function inMemoryEntries(): EntryRepository {
  const stored: { readonly userId: UserId; readonly entry: Entry }[] = [];
  return {
    save: (userId: UserId, entry: Entry): Promise<Result<void, DomainError>> => {
      stored.push({ userId, entry });
      return Promise.resolve(ok(undefined));
    },
    search: (userId: UserId): Promise<Result<readonly Entry[], DomainError>> =>
      Promise.resolve(
        ok(stored.filter((row) => row.userId === userId).map((row) => row.entry)),
      ),
  };
}

const ADA: AuthContext = { userId: '01920000-0000-7000-8000-0000000000a1' as UserId };
const GRACE: AuthContext = { userId: '01920000-0000-7000-8000-0000000000a2' as UserId };

const unavailableEntries: EntryRepository = {
  save: () => Promise.resolve(err(domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.'))),
  search: () => Promise.resolve(ok([])),
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
  searchEntries: SearchEntries;
} {
  return {
    postEntry: createPostEntry({ entries, newEntryId: () => ENTRY_ID, now: () => CREATED_AT }),
    searchEntries: createSearchEntries({ entries }),
  };
}

describe('createPostEntry', () => {
  it('stores a balanced entry, stamped with the injected id and clock, where it is found', async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, draft(12500, 12500));

    expect(isOk(posted)).toBe(true);
    if (!isOk(posted)) return;
    expect(posted.value.id).toBe(ENTRY_ID);
    expect(posted.value.createdAt).toEqual(CREATED_AT);
    expect(posted.value.total).toBe(12500);

    const found = await searchEntries(ADA, NO_CRITERIA);
    expect(isOk(found)).toBe(true);
    if (!isOk(found)) return;
    expect(found.value).toEqual([posted.value]);
  });

  it('refuses an unbalanced entry and stores nothing', async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, draft(12500, 12000));

    expect(isErr(posted)).toBe(true);
    if (!isErr(posted)) return;
    expect(posted.error.code).toBe('UNBALANCED');

    const found = await searchEntries(ADA, NO_CRITERIA);
    expect(isOk(found)).toBe(true);
    if (!isOk(found)) return;
    expect(found.value).toEqual([]);
  });

  it('reports a failed save as its own result, rather than the entry it could not keep', async () => {
    const { postEntry } = useCases(unavailableEntries);

    const posted = await postEntry(ADA, draft(12500, 12500));

    expect(isErr(posted)).toBe(true);
    if (!isErr(posted)) return;
    expect(posted.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it("stores the entry as the signed-in User's, where no other User finds it", async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(ADA, draft(12500, 12500));

    expect(isOk(posted)).toBe(true);
    if (!isOk(posted)) return;
    expect(await searchEntries(ADA, NO_CRITERIA)).toEqual(ok([posted.value]));
    expect(await searchEntries(GRACE, NO_CRITERIA)).toEqual(ok([]));
  });

  it('refuses to post for nobody, as unauthenticated, and stores nothing', async () => {
    const { postEntry, searchEntries } = useCases(inMemoryEntries());

    const posted = await postEntry(SIGNED_OUT, draft(12500, 12000));

    expect(isErr(posted) && posted.error.code).toBe('UNAUTHENTICATED');
    expect(await searchEntries(ADA, NO_CRITERIA)).toEqual(ok([]));
  });
});
