import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isErr, isOk, type EntryId, type Money, type UserId } from '@repo/contracts';
import { createDatabase } from '@repo/db';
import { type LogFields, type Logger } from '../../logging/ports/logger';
import { makeEntry, type Entry, type EntryDraft } from '../domain/entry';
import { NO_CRITERIA, type SearchCriteria } from '../domain/search-criteria';
import { createPostgresEntryRepository } from './postgres-entry-repository';

const databaseUrl = process.env['TEST_DATABASE_URL'];
if (databaseUrl === undefined) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Run integration tests with `pnpm test:integration`, ' +
      'which starts the Postgres container this suite needs.',
  );
}

const UNREACHABLE_URL = 'postgresql://absent:absent@127.0.0.1:1/absent';

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

async function found(
  userId: UserId = ADA,
  criteria: SearchCriteria = NO_CRITERIA,
): Promise<readonly Entry[]> {
  const result = await repository.search(userId, criteria);
  expect(isOk(result)).toBe(true);
  return isOk(result) ? result.value : [];
}

async function memosFound(criteria: SearchCriteria, userId: UserId = ADA): Promise<string[]> {
  return (await found(userId, criteria)).map((entry) => entry.memo);
}

async function countEntries(): Promise<number> {
  const result = await database.execute<{ count: number }>(
    sql`select count(*)::int as count from entries`,
  );
  return result.rows[0]?.count ?? -1;
}

describe('createPostgresEntryRepository', () => {
  it('answers with an entry as it was saved: day, memo, instant, lines in order, total', async () => {
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
    expect(await found()).toEqual([saved]);
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

    expect((await found())[0]?.total).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('answers with the latest day first, and the latest created first within a day', async () => {
    const on = (entryDate: string, createdAt: string): Entry =>
      entry({ entryDate, createdAt: new Date(createdAt) });
    const earlyDayLate = on('2026-09-14', '2026-09-17T00:00:00Z');
    const lateDayEarly = on('2026-09-15', '2026-09-15T00:00:00Z');
    const lateDayLate = on('2026-09-15', '2026-09-16T00:00:00Z');
    const future = on('2126-01-01', '2026-09-10T00:00:00Z');

    for (const saved of [earlyDayLate, lateDayEarly, lateDayLate, future]) {
      await repository.save(ADA, saved);
    }

    expect((await found()).map((entryFound) => entryFound.id)).toEqual([
      future.id,
      lateDayLate.id,
      lateDayEarly.id,
      earlyDayLate.id,
    ]);
  });

  it('answers with nothing when nothing was saved', async () => {
    expect(await found()).toEqual([]);
  });

  it('writes nothing when the database refuses one of the lines (ADR-0011)', async () => {
    const valid = entry();
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
        error: expect.objectContaining({ code: '22P02' }) as unknown,
      },
    ]);
  });

  it('refuses a second entry with the same id and keeps the first', async () => {
    const saved = entry();
    await repository.save(ADA, saved);

    const result = await repository.save(ADA, { ...saved, memo: 'Overwritten' });

    expect(isErr(result)).toBe(true);
    expect(await found()).toEqual([saved]);
    expect(logged).toEqual([
      {
        event: 'entries.save_failed',
        entryId: saved.id,
        error: expect.objectContaining({ code: '23505' }) as unknown,
      },
    ]);
    expect(JSON.stringify(logged)).not.toContain('Overwritten');
  });

  it('reports a stored entry that breaks a rule rather than answering with it', async () => {
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
      'entries.search_failed',
    ]);
    expect(logged.map((fields) => fields['error'])).toEqual([
      expect.objectContaining({ code: 'ECONNREFUSED' }),
      expect.objectContaining({ code: 'ECONNREFUSED' }),
    ]);
  });

  it("answers with one User's entries to nobody else (ADR-0021)", async () => {
    const adas = entry({ memo: 'Ada' });
    const graces = entry({ memo: 'Grace' });

    await repository.save(ADA, adas);
    await repository.save(GRACE, graces);

    expect(await found(ADA)).toEqual([adas]);
    expect(await found(GRACE)).toEqual([graces]);
  });

  it('answers with nothing for a User who has written nothing, whatever others have', async () => {
    await repository.save(GRACE, entry());

    expect(await found(ADA)).toEqual([]);
  });

  it('narrows to a day range, and includes an entry posted on either end', async () => {
    await repository.save(ADA, entry({ entryDate: '2026-05-31', memo: 'The day before' }));
    await repository.save(ADA, entry({ entryDate: '2026-06-01', memo: 'The first day' }));
    await repository.save(ADA, entry({ entryDate: '2026-06-15', memo: 'In between' }));
    await repository.save(ADA, entry({ entryDate: '2026-06-30', memo: 'The last day' }));
    await repository.save(ADA, entry({ entryDate: '2026-07-01', memo: 'The day after' }));

    expect(await memosFound({ from: '2026-06-01', to: '2026-06-30' })).toEqual([
      'The last day',
      'In between',
      'The first day',
    ]);
  });

  it('narrows by the first day alone, and by the last day alone', async () => {
    await repository.save(ADA, entry({ entryDate: '2026-05-31', memo: 'May' }));
    await repository.save(ADA, entry({ entryDate: '2026-06-01', memo: 'June' }));

    expect(await memosFound({ from: '2026-06-01' })).toEqual(['June']);
    expect(await memosFound({ to: '2026-05-31' })).toEqual(['May']);
  });

  it('answers with the one entry a range of a single day holds', async () => {
    await repository.save(ADA, entry({ entryDate: '2026-06-14', memo: 'The eve' }));
    await repository.save(ADA, entry({ entryDate: '2026-06-15', memo: 'The day' }));
    await repository.save(ADA, entry({ entryDate: '2026-06-16', memo: 'The morrow' }));

    expect(await memosFound({ from: '2026-06-15', to: '2026-06-15' })).toEqual(['The day']);
  });

  it('answers with nothing, rather than everything, for a range nothing falls in', async () => {
    await repository.save(ADA, entry({ entryDate: '2026-06-15' }));

    expect(await memosFound({ from: '2026-01-01', to: '2026-01-31' })).toEqual([]);
  });

  it('brings back the lines of the entries in the range, and of no others', async () => {
    const inside = entry({
      entryDate: '2026-06-15',
      memo: 'Inside',
      lines: [
        { account: 'expense', side: 'debit', amount: 300 as Money },
        { account: 'cash', side: 'credit', amount: 300 as Money },
      ],
    });
    await repository.save(ADA, inside);
    await repository.save(ADA, entry({ entryDate: '2026-07-15', memo: 'Outside' }));

    expect(await found(ADA, { from: '2026-06-01', to: '2026-06-30' })).toEqual([inside]);
  });

  it('answers with an entry whose debit line names the Account, and with one whose credit line does', async () => {
    await repository.save(
      ADA,
      entry({
        entryDate: '2026-06-10',
        memo: 'Cash in',
        lines: [
          { account: 'cash', side: 'debit', amount: 300 as Money },
          { account: 'sales', side: 'credit', amount: 300 as Money },
        ],
      }),
    );
    await repository.save(
      ADA,
      entry({
        entryDate: '2026-06-11',
        memo: 'Cash out',
        lines: [
          { account: 'expense', side: 'debit', amount: 300 as Money },
          { account: 'cash', side: 'credit', amount: 300 as Money },
        ],
      }),
    );
    await repository.save(
      ADA,
      entry({
        entryDate: '2026-06-12',
        memo: 'No cash',
        lines: [
          { account: 'expense', side: 'debit', amount: 300 as Money },
          { account: 'payable', side: 'credit', amount: 300 as Money },
        ],
      }),
    );

    expect(await memosFound({ account: 'cash' })).toEqual(['Cash out', 'Cash in']);
  });

  it('answers with the whole entry, though one of its lines named the Account', async () => {
    const posting = entry({
      memo: 'Rent',
      lines: [
        { account: 'expense', side: 'debit', amount: 700 as Money },
        { account: 'cash', side: 'credit', amount: 400 as Money },
        { account: 'payable', side: 'credit', amount: 300 as Money },
      ],
    });
    await repository.save(ADA, posting);

    expect(await found(ADA, { account: 'cash' })).toEqual([posting]);
  });

  it('answers with nothing for an Account nothing in the books touches', async () => {
    await repository.save(ADA, entry());

    expect(await memosFound({ account: 'capital' })).toEqual([]);
  });

  it('narrows by the Account and the day range together, with `and`', async () => {
    const onCash = [
      { account: 'expense', side: 'debit', amount: 300 as Money },
      { account: 'cash', side: 'credit', amount: 300 as Money },
    ] as const;
    await repository.save(ADA, entry({ entryDate: '2026-06-15', memo: 'June, cash', lines: onCash }));
    await repository.save(ADA, entry({ entryDate: '2026-07-15', memo: 'July, cash', lines: onCash }));
    await repository.save(
      ADA,
      entry({
        entryDate: '2026-06-16',
        memo: 'June, on account',
        lines: [
          { account: 'expense', side: 'debit', amount: 300 as Money },
          { account: 'payable', side: 'credit', amount: 300 as Money },
        ],
      }),
    );

    expect(
      await memosFound({ from: '2026-06-01', to: '2026-06-30', account: 'cash' }),
    ).toEqual(['June, cash']);
  });

  it("keeps an Account search inside one User's books (ADR-0021)", async () => {
    const onCash = [
      { account: 'expense', side: 'debit', amount: 300 as Money },
      { account: 'cash', side: 'credit', amount: 300 as Money },
    ] as const;
    await repository.save(ADA, entry({ memo: 'Ada', lines: onCash }));
    await repository.save(GRACE, entry({ memo: 'Grace', lines: onCash }));

    expect(await memosFound({ account: 'cash' }, ADA)).toEqual(['Ada']);
    expect(await memosFound({ account: 'cash' }, GRACE)).toEqual(['Grace']);
  });

  it('keeps a range inside one User\'s books (ADR-0021)', async () => {
    await repository.save(ADA, entry({ entryDate: '2026-06-15', memo: 'Ada' }));
    await repository.save(GRACE, entry({ entryDate: '2026-06-15', memo: 'Grace' }));

    const range = { from: '2026-06-01', to: '2026-06-30' };

    expect(await memosFound(range, ADA)).toEqual(['Ada']);
    expect(await memosFound(range, GRACE)).toEqual(['Grace']);
  });

  it('narrows to the entries whose memo contains the term, whatever the case of either', async () => {
    await repository.save(ADA, entry({ memo: 'Coffee beans' }));
    await repository.save(ADA, entry({ memo: 'COFFEE machine' }));
    await repository.save(ADA, entry({ memo: 'Rail fare' }));

    expect((await memosFound({ memo: 'coffee' })).toSorted()).toEqual([
      'COFFEE machine',
      'Coffee beans',
    ]);
    expect((await memosFound({ memo: 'COFFEE' })).toSorted()).toEqual([
      'COFFEE machine',
      'Coffee beans',
    ]);
  });

  it('matches a term anywhere in the memo, not only where it starts', async () => {
    await repository.save(ADA, entry({ memo: 'Quarterly rent, June' }));

    expect(await memosFound({ memo: 'rent' })).toEqual(['Quarterly rent, June']);
  });

  it('matches a percent sign in a term literally, rather than as everything', async () => {
    await repository.save(ADA, entry({ memo: '10% deposit' }));
    await repository.save(ADA, entry({ memo: 'Rail fare' }));

    expect(await memosFound({ memo: '10%' })).toEqual(['10% deposit']);
    expect(await memosFound({ memo: '%' })).toEqual(['10% deposit']);
  });

  it('matches an underscore in a term literally, rather than as any character', async () => {
    await repository.save(ADA, entry({ memo: 'Invoice no_42' }));
    await repository.save(ADA, entry({ memo: 'Invoice no 43' }));

    expect(await memosFound({ memo: 'no_4' })).toEqual(['Invoice no_42']);
  });

  it('matches the escape character in a term literally, rather than escaping with it', async () => {
    await repository.save(ADA, entry({ memo: String.raw`Path C:\temp` }));
    await repository.save(ADA, entry({ memo: 'Path C:temp' }));

    expect(await memosFound({ memo: String.raw`C:\temp` })).toEqual([String.raw`Path C:\temp`]);
    expect(await memosFound({ memo: '\\' })).toEqual([String.raw`Path C:\temp`]);
  });

  it('answers with nothing for a term no memo of the User contains', async () => {
    await repository.save(ADA, entry({ memo: 'Rail fare' }));

    expect(await memosFound({ memo: 'coffee' })).toEqual([]);
  });

  it('narrows by the memo, the Account and the day range together, with `and`', async () => {
    const onCash = [
      { account: 'expense', side: 'debit', amount: 300 as Money },
      { account: 'cash', side: 'credit', amount: 300 as Money },
    ] as const;
    const onAccount = [
      { account: 'expense', side: 'debit', amount: 300 as Money },
      { account: 'payable', side: 'credit', amount: 300 as Money },
    ] as const;
    await repository.save(ADA, entry({ entryDate: '2026-06-15', memo: 'Rent June', lines: onCash }));
    await repository.save(ADA, entry({ entryDate: '2026-07-15', memo: 'Rent July', lines: onCash }));
    await repository.save(
      ADA,
      entry({ entryDate: '2026-06-15', memo: 'Rent June on account', lines: onAccount }),
    );
    await repository.save(ADA, entry({ entryDate: '2026-06-15', memo: 'Fuel June', lines: onCash }));

    expect(
      await memosFound({ from: '2026-06-01', to: '2026-06-30', account: 'cash', memo: 'rent' }),
    ).toEqual(['Rent June']);
  });

  it("keeps a memo search inside one User's books (ADR-0021)", async () => {
    await repository.save(ADA, entry({ memo: 'Coffee, Ada' }));
    await repository.save(GRACE, entry({ memo: 'Coffee, Grace' }));

    expect(await memosFound({ memo: 'coffee' }, ADA)).toEqual(['Coffee, Ada']);
    expect(await memosFound({ memo: 'coffee' }, GRACE)).toEqual(['Coffee, Grace']);
  });

  it('brings back the lines of the entries the memo matched, and of no others', async () => {
    const matching = entry({
      memo: 'Coffee beans',
      lines: [
        { account: 'expense', side: 'debit', amount: 300 as Money },
        { account: 'cash', side: 'credit', amount: 300 as Money },
      ],
    });
    await repository.save(ADA, matching);
    await repository.save(ADA, entry({ memo: 'Rail fare' }));

    expect(await found(ADA, { memo: 'coffee' })).toEqual([matching]);
  });

  it('cannot hold an entry with no User, since M2 (ADR-0021)', async () => {
    const refused = database.execute(
      sql`insert into entries (id, entry_date, memo, created_at) values ('01920000-0000-7000-8000-0000000000ff', '2026-09-15', 'Ownerless', now())`,
    );

    await expect(refused).rejects.toMatchObject({ cause: { code: '23502' } });
  });
});
