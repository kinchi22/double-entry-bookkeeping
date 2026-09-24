import { and, asc, desc, eq, exists, gte, ilike, lte, type SQL } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import {
  domainError,
  err,
  ok,
  sideSchema,
  type DomainError,
  type EntryId,
  type Err,
  type Result,
  type UserId,
} from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
import { money } from '../../money/domain/money';
import { makeEntry, type AccountCode, type Entry, type EntryDraft } from '../domain/entry';
import { type SearchCriteria } from '../domain/search-criteria';
import { type EntryRepository } from '../ports/entry-repository';

export type PostgresEntryRepository = EntryRepository & {
  close: () => Promise<void>;
};

type EntryRow = typeof schema.entries.$inferSelect;
type LineRow = typeof schema.entryLines.$inferSelect;

export function createPostgresEntryRepository(
  connectionString: string,
  logger: Logger,
): PostgresEntryRepository {
  const { database, close } = createDatabase(connectionString);

  return {
    save: async (userId: UserId, entry: Entry): Promise<Result<void, DomainError>> => {
      try {
        await database.transaction(async (transaction) => {
          await transaction.insert(schema.entries).values({
            id: entry.id,
            userId,
            entryDate: entry.entryDate,
            memo: entry.memo,
            createdAt: entry.createdAt,
          });
          await transaction.insert(schema.entryLines).values(
            entry.lines.map((line, index) => ({
              entryId: entry.id,
              lineNumber: index + 1,
              account: line.account,
              side: line.side,
              amount: line.amount,
            })),
          );
        });
        return ok(undefined);
      } catch (error) {
        logger.error(
          { event: 'entries.save_failed', entryId: entry.id, error: describeError(error) },
          'An entry could not be stored.',
        );
        return unavailable('The entry could not be stored.');
      }
    },

    search: async (
      userId: UserId,
      criteria: SearchCriteria,
    ): Promise<Result<readonly Entry[], DomainError>> => {
      const matching = matches(userId, criteria);
      let entryRows: EntryRow[];
      let lineRows: LineRow[];
      try {
        entryRows = await database
          .select()
          .from(schema.entries)
          .where(matching)
          .orderBy(
            desc(schema.entries.entryDate),
            desc(schema.entries.createdAt),
            desc(schema.entries.id),
          );
        lineRows = await database
          .select({
            entryId: schema.entryLines.entryId,
            lineNumber: schema.entryLines.lineNumber,
            account: schema.entryLines.account,
            side: schema.entryLines.side,
            amount: schema.entryLines.amount,
          })
          .from(schema.entryLines)
          .innerJoin(schema.entries, eq(schema.entries.id, schema.entryLines.entryId))
          .where(matching)
          .orderBy(asc(schema.entryLines.entryId), asc(schema.entryLines.lineNumber));
      } catch (error) {
        logger.error(
          { event: 'entries.search_failed', error: describeError(error) },
          'The entries could not be read.',
        );
        return unavailable('The entries could not be read.');
      }

      const linesByEntry = new Map<string, LineRow[]>();
      for (const line of lineRows) {
        const lines = linesByEntry.get(line.entryId) ?? [];
        lines.push(line);
        linesByEntry.set(line.entryId, lines);
      }

      const entries: Entry[] = [];
      for (const row of entryRows) {
        const entry = restore(row, linesByEntry.get(row.id) ?? []);
        if (!entry.ok) {
          logger.error(
            { event: 'entries.stored_entry_invalid', entryId: row.id, reason: entry.error.message },
            'A stored entry breaks a rule, so the search did not answer.',
          );
          return entry;
        }
        entries.push(entry.value);
      }
      return ok(entries);
    },

    close,
  };
}

const unavailable = (message: string): Err<DomainError> =>
  err(domainError('DEPENDENCY_UNAVAILABLE', message));

function matches(userId: UserId, criteria: SearchCriteria): SQL | undefined {
  return and(
    eq(schema.entries.userId, userId),
    ...(criteria.from === undefined ? [] : [gte(schema.entries.entryDate, criteria.from)]),
    ...(criteria.to === undefined ? [] : [lte(schema.entries.entryDate, criteria.to)]),
    ...(criteria.account === undefined ? [] : [touches(criteria.account)]),
    ...(criteria.memo === undefined ? [] : [ilike(schema.entries.memo, containing(criteria.memo))]),
  );
}

const LIKE_ESCAPE = '\\';

const LIKE_SPECIAL = new Set([LIKE_ESCAPE, '%', '_']);

function containing(term: string): string {
  let literal = '';
  for (const character of term) {
    literal += LIKE_SPECIAL.has(character) ? `${LIKE_ESCAPE}${character}` : character;
  }
  return `%${literal}%`;
}

function touches(account: AccountCode): SQL {
  return exists(
    new QueryBuilder()
      .select({ entryId: schema.entryLines.entryId })
      .from(schema.entryLines)
      .where(
        and(
          eq(schema.entryLines.entryId, schema.entries.id),
          eq(schema.entryLines.account, account),
        ),
      ),
  );
}

function restore(row: EntryRow, lineRows: readonly LineRow[]): Result<Entry, DomainError> {
  const lines: EntryDraft['lines'][number][] = [];
  for (const line of lineRows) {
    const side = sideSchema.safeParse(line.side);
    const amount = money(line.amount);
    if (!side.success || !amount.ok) {
      return unavailable(`Stored entry ${row.id} has a line with no valid side or amount.`);
    }
    lines.push({ account: line.account, side: side.data, amount: amount.value });
  }

  const entry = makeEntry(
    { entryDate: row.entryDate, memo: row.memo, lines },
    { id: row.id as EntryId, createdAt: row.createdAt },
  );
  return entry.ok
    ? entry
    : unavailable(`Stored entry ${row.id} breaks a rule: ${entry.error.message}`);
}
