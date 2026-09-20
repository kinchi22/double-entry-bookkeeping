import { asc, desc, eq } from 'drizzle-orm';
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
import { makeEntry, type Entry, type EntryDraft } from '../domain/entry';
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
     * Matching happens in the query and never in memory. No criterion exists
     * yet, so nothing narrows the `user_id` both reads already filter on: an
     * absent criterion contributes no condition, and a search with none is
     * every entry the User owns.
     */
    search: async (
      userId: UserId,
      _criteria: SearchCriteria,
    ): Promise<Result<readonly Entry[], DomainError>> => {
      let entryRows: EntryRow[];
      let lineRows: LineRow[];
      try {
        entryRows = await database
          .select()
          .from(schema.entries)
          .where(eq(schema.entries.userId, userId))
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
          .where(eq(schema.entries.userId, userId))
          .orderBy(asc(schema.entryLines.entryId), asc(schema.entryLines.lineNumber));
      } catch (error) {
        logger.error(
          { event: 'entries.list_failed', error: describeError(error) },
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
            'A stored entry breaks a rule, so the entries were not listed.',
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
 * Rebuilds a stored entry through the same rules that admitted it.
 *
 * The database enforces shape and none of the rules (ADR-0010), so a row
 * written around the app can hold an unbalanced entry or an unknown side. That
 * is reported as this app's failure rather than listed, and rather than blamed
 * on the caller with the code the rule would have given a draft.
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
