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

/**
 * Entries in Postgres: a row in `entries` and one row per line in
 * `entry_lines`, numbered from 1 in the order the lines were entered.
 *
 * Every row in `entries` is written with its User, and every read filters on
 * it, so another User's entries are never read. ADR-0021.
 *
 * It takes a connection string for the reason the health probe does: the
 * composition root may not import @repo/db.
 *
 * A database failure is a returned `DEPENDENCY_UNAVAILABLE`, never a thrown
 * error. Its message stays generic, because a driver's message names hosts and
 * ports, and a message can reach an HTTP response. What went wrong goes to the
 * logger instead, described by `describeError`. ADR-0018.
 */
export function createPostgresEntryRepository(
  connectionString: string,
  logger: Logger,
): PostgresEntryRepository {
  const { database, close } = createDatabase(connectionString);

  return {
    /**
     * One transaction, because an entry without all of its lines is a ledger
     * that no longer balances and says nothing about it. ADR-0011.
     */
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

    /**
     * Two reads rather than a join, entries first. Under read committed an
     * entry committed between them brings lines the first read has no entry
     * for, and those are ignored; an entry the first read saw has all of its
     * lines committed already, because they were written in its transaction.
     *
     * Matching happens in the query and never in memory, and both reads are
     * narrowed the same way, so the lines that come back are the lines of the
     * entries that matched.
     */
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
        // A line belongs to a User through its entry.
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

/**
 * What a searched entry has to satisfy, as one condition for the query planner.
 *
 * The User is always part of it, so a read that forgot a criterion would still
 * never cross into another User's books (ADR-0021). A criterion that was not
 * asked for adds no condition, which is what makes a search with none every
 * entry the User owns. Both ends of a day range are compared inclusively,
 * against `entry_date` -- the day the entry was posted, not the instant it was
 * typed.
 */
function matches(userId: UserId, criteria: SearchCriteria): SQL | undefined {
  return and(
    eq(schema.entries.userId, userId),
    ...(criteria.from === undefined ? [] : [gte(schema.entries.entryDate, criteria.from)]),
    ...(criteria.to === undefined ? [] : [lte(schema.entries.entryDate, criteria.to)]),
    ...(criteria.account === undefined ? [] : [touches(criteria.account)]),
    ...(criteria.memo === undefined ? [] : [ilike(schema.entries.memo, containing(criteria.memo))]),
  );
}

/**
 * The escape character `like` and `ilike` take unless one is named, which is
 * why every one of them in a term is doubled below.
 */
const LIKE_ESCAPE = '\\';

/**
 * A memo term as the pattern that finds it anywhere in a memo.
 *
 * `ilike` rather than `lower(memo) like lower(...)`: one operator, and the same
 * answer without lower-casing a column on every row. It is a pattern language,
 * so what the User typed is escaped into it -- `%`, `_` and the escape
 * character itself. The wildcards in a term are the User's to type and not to
 * mean: a term of `%` finds the memo with a percent sign in it, rather than
 * every memo there is.
 *
 * The pattern travels as a bound parameter, so nothing here is about quoting.
 */
function containing(term: string): string {
  const literal = term.replaceAll(/[\\%_]/gu, (character) => `${LIKE_ESCAPE}${character}`);
  return `%${literal}%`;
}

/**
 * That the entry has a line naming the account, as a condition on the entry.
 *
 * `exists` rather than a join: an entry with two lines on the account would
 * come back twice from a join, and the criterion is about the entry rather than
 * about which of its lines matched. Which is also why the condition stays on
 * the entry in both reads -- the lines that come back are the entry's lines,
 * every one of them, not the ones that matched.
 *
 * The subquery is built without a connection, because this condition is the
 * same whichever database it runs against.
 */
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

/**
 * Rebuilds a stored entry through the same rules that admitted it.
 *
 * The database enforces shape and none of the rules (ADR-0010), so a row
 * written around the app can hold an unbalanced entry or an unknown side. That
 * is reported as this app's failure rather than answered with, and rather than
 * blamed on the caller with the code the rule would have given a draft.
 */
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
    // The column is a uuid that only `save` writes, and it writes an EntryId.
    { id: row.id as EntryId, createdAt: row.createdAt },
  );
  return entry.ok
    ? entry
    : unavailable(`Stored entry ${row.id} breaks a rule: ${entry.error.message}`);
}
