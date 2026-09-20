import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk, type EntryId, type Money, type UserId } from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { makeEntry, type Entry, type EntryDraft } from '../domain/entry';
import { NO_CRITERIA } from '../domain/search-criteria';
import { createPostgresEntryRepository } from './postgres-entry-repository';

/**
 * Integration test: the repository against a real, migrated Postgres, for the
 * reason the health probe's test gives. What is worth asserting here -- that an
 * entry comes back as it went in, in the promised order, and that a half-written
 * entry cannot exist -- only happens on a real server.
 *
 * The container comes from tools/integration/postgres-container.ts, migrated
 * with the committed migrations. Files take turns on it, and each test here
 * starts from empty tables.
 */
const databaseUrl = process.env['TEST_DATABASE_URL'];
if (databaseUrl === undefined) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Run integration tests with `pnpm test:integration`, ' +
      'which starts the Postgres container this suite needs.',
  );
}

/** Port 1 is reserved and nothing binds it, so the connection is refused immediately. */
const UNREACHABLE_URL = 'postgresql://absent:absent@127.0.0.1:1/absent';

/** A logger that keeps what it is given, so a test can read what was reported. */
const logged: LogFields[] = [];
const logger: Logger = {
  error: (fields) => {
    logged.push(fields);
  },
};

const repository = createPostgresEntryRepository(databaseUrl, logger);
const dead = createPostgresEntryRepository(UNREACHABLE_URL, logger);
const { database, close } = createDatabase(databaseUrl);

afterAll(async () => {
  await Promise.all([repository.close(), dead.close(), close()]);
});

const ADA = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE = '01920000-0000-7000-8000-0000000000a2' as UserId;

beforeEach(async () => {
  await database.execute(sql`truncate table users, entry_lines, entries cascade`);
  for (const [id, email] of [
    [ADA, 'ada@example.com'],
    [GRACE, 'grace@example.com'],
  ]) {
    await database.execute(
      sql`insert into users (id, email, created_at) values (${id}, ${email}, now())`,
    );
  }
  logged.length = 0;
});

let sequence = 0;

/** A valid entry, with a fresh v7-shaped id, or a failed assertion. */
function entry(overrides: Partial<EntryDraft> & { readonly createdAt?: Date } = {}): Entry {
  sequence += 1;
  const { createdAt = new Date('2026-09-15T00:30:00.000Z'), ...draft } = overrides;
  const made = makeEntry(
    {
      entryDate: '2026-09-15',
      memo: 'Office supplies',
      lines: [
        { account: 'expense', side: 'debit', amount: 12500 as Money },
        { account: 'cash', side: 'credit', amount: 12500 as Money },
      ],
      ...draft,
    },
    {
      id: `01920000-0000-7000-8000-${sequence.toString().padStart(12, '0')}` as EntryId,
      createdAt,
    },
  );
  expect(isOk(made), 'test setup built an entry that breaks a rule').toBe(true);
  return isOk(made) ? made.value : ({} as Entry);
}

async function listed(userId: UserId = ADA): Promise<readonly Entry[]> {
  const result = await repository.search(userId, NO_CRITERIA);
  expect(isOk(result)).toBe(true);
  return isOk(result) ? result.value : [];
}

async function countEntries(): Promise<number> {
  const result = await database.execute<{ count: number }>(
    sql`select count(*)::int as count from entries`,
  );
  return result.rows[0]?.count ?? -1;
}

describe('createPostgresEntryRepository', () => {
  it('lists an entry as it was saved: day, memo, instant, lines in order, total', async () => {
    const saved = entry({
      lines: [
        { account: 'cash', side: 'credit', amount: 5000 as Money },
        { account: 'expense', side: 'debit', amount: 12500 as Money },
        { account: 'cash', side: 'credit', amount: 7500 as Money },
      ],
      createdAt: new Date('2026-09-15T09:30:00.123+09:00'),
    });

    const result = await repository.save(ADA, saved);

    expect(isOk(result)).toBe(true);
    expect(await listed()).toEqual([saved]);
    expect(logged).toEqual([]);
  });

  it('keeps an amount at the edge of the safe integer range exact', async () => {
    const saved = entry({
      lines: [
        { account: 'expense', side: 'debit', amount: Number.MAX_SAFE_INTEGER as Money },
        { account: 'cash', side: 'credit', amount: Number.MAX_SAFE_INTEGER as Money },
      ],
    });

    await repository.save(ADA, saved);

    expect((await listed())[0]?.total).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('lists the latest day first, and the latest created first within a day', async () => {
    const on = (entryDate: string, createdAt: string): Entry =>
      entry({ entryDate, createdAt: new Date(createdAt) });
    const earlyDayLate = on('2026-09-14', '2026-09-17T00:00:00Z');
    const lateDayEarly = on('2026-09-15', '2026-09-15T00:00:00Z');
    const lateDayLate = on('2026-09-15', '2026-09-16T00:00:00Z');
    const future = on('2126-01-01', '2026-09-10T00:00:00Z');

    for (const saved of [earlyDayLate, lateDayEarly, lateDayLate, future]) {
      await repository.save(ADA, saved);
    }

    expect((await listed()).map((listedEntry) => listedEntry.id)).toEqual([
      future.id,
      lateDayLate.id,
      lateDayEarly.id,
      earlyDayLate.id,
    ]);
  });

  it('lists nothing when nothing was saved', async () => {
    expect(await listed()).toEqual([]);
  });

  it('writes nothing when the database refuses one of the lines (ADR-0011)', async () => {
    const valid = entry();
    // NaN passes the type and no bigint column accepts it, so the lines insert
    // fails after the entry insert has run inside the transaction.
    const refused: Entry = {
      ...valid,
      lines: valid.lines.map((line, index) =>
        index === 1 ? { ...line, amount: Number.NaN as Money } : line,
      ),
    };

    const result = await repository.save(ADA, refused);

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(await countEntries()).toBe(0);
    expect(logged).toEqual([
      {
        event: 'entries.save_failed',
        entryId: valid.id,
        // invalid_text_representation: Postgres read "NaN" as a bigint.
        error: expect.objectContaining({ code: '22P02' }) as unknown,
      },
    ]);
  });

  it('refuses a second entry with the same id and keeps the first', async () => {
    const saved = entry();
    await repository.save(ADA, saved);

    const result = await repository.save(ADA, { ...saved, memo: 'Overwritten' });

    expect(isErr(result)).toBe(true);
    expect(await listed()).toEqual([saved]);
    // unique_violation, and not a word of the refused row: the memo travels in
    // the query's params, which are never logged.
    expect(logged).toEqual([
      {
        event: 'entries.save_failed',
        entryId: saved.id,
        error: expect.objectContaining({ code: '23505' }) as unknown,
      },
    ]);
    expect(JSON.stringify(logged)).not.toContain('Overwritten');
  });

  it('reports a stored entry that breaks a rule rather than listing it', async () => {
    const saved = entry();
    await repository.save(ADA, saved);
    await database.execute(
      sql`update entry_lines set amount = 12000 where entry_id = ${saved.id} and line_number = 2`,
    );

    const result = await repository.search(ADA, NO_CRITERIA);

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(result.error.message).toContain(saved.id);
    expect(logged).toEqual([
      {
        event: 'entries.stored_entry_invalid',
        entryId: saved.id,
        reason: expect.stringContaining('differ') as unknown,
      },
    ]);
  });

  it('reports a stored line with a side that is not debit or credit', async () => {
    const saved = entry();
    await repository.save(ADA, saved);
    await database.execute(
      sql`update entry_lines set side = 'minus' where entry_id = ${saved.id} and line_number = 1`,
    );

    const result = await repository.search(ADA, NO_CRITERIA);

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(result.error.message).toContain(saved.id);
  });

  it('reports an unreachable database as a result on both paths, never by throwing', async () => {
    const saved = await dead.save(ADA, entry());
    const read = await dead.search(ADA, NO_CRITERIA);

    expect(isErr(saved) && saved.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(isErr(read) && read.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(logged.map((fields) => fields.event)).toEqual([
      'entries.save_failed',
      'entries.list_failed',
    ]);
    expect(logged.map((fields) => fields['error'])).toEqual([
      expect.objectContaining({ code: 'ECONNREFUSED' }),
      expect.objectContaining({ code: 'ECONNREFUSED' }),
    ]);
  });

  it("lists one User's entries to nobody else (ADR-0021)", async () => {
    const adas = entry({ memo: 'Ada' });
    const graces = entry({ memo: 'Grace' });

    await repository.save(ADA, adas);
    await repository.save(GRACE, graces);

    expect(await listed(ADA)).toEqual([adas]);
    expect(await listed(GRACE)).toEqual([graces]);
  });

  it('lists nothing for a User who has written nothing, whatever others have', async () => {
    await repository.save(GRACE, entry());

    expect(await listed(ADA)).toEqual([]);
  });

  it('cannot hold an entry with no User, since M2 (ADR-0021)', async () => {
    const refused = database.execute(
      sql`insert into entries (id, entry_date, memo, created_at) values ('01920000-0000-7000-8000-0000000000ff', '2026-09-15', 'Ownerless', now())`,
    );

    await expect(refused).rejects.toMatchObject({ cause: { code: '23502' } });
  });
});
