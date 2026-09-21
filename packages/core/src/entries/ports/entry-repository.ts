import { type DomainError, type Result, type UserId } from '@repo/contracts';
import { type Entry } from '../domain/entry';
import { type SearchCriteria } from '../domain/search-criteria';

/**
 * Where entries are kept, stated in domain terms.
 *
 * Two implementations exist: the Postgres adapter and the in-memory stub the
 * use case tests run against.
 *
 * An entry is an aggregate (ADR-0011): it owns its lines, and `save` writes the
 * entry and every line as one unit or writes nothing. A boundary wider than one
 * entry belongs to a use case, and no method here opens one.
 *
 * Every entry belongs to one User, and every method takes that User, required
 * by its signature, so a read or a write that forgets whose books it touches
 * does not compile. Another User's entries are never in an answer. ADR-0021.
 */
export type EntryRepository = {
  /** Stores an entry and its lines, in order, atomically, as `userId`'s. */
  readonly save: (userId: UserId, entry: Entry) => Promise<Result<void, DomainError>>;
  /**
   * The entries `userId` owns that the criteria match, the latest day first,
   * and entries on the same day most recently created first.
   *
   * There is one read, not two: a search with no criterion is every entry the
   * User owns, which is what `/entries` asks for.
   *
   * The criteria have passed `makeSearchCriteria`, so an implementation applies
   * them rather than judging them, and matches in its query rather than in
   * memory. A memo term arrives trimmed and is matched as a substring, case
   * insensitively, and literally: what is in it is a character to find rather
   * than a pattern to run.
   */
  readonly search: (
    userId: UserId,
    criteria: SearchCriteria,
  ) => Promise<Result<readonly Entry[], DomainError>>;
};
