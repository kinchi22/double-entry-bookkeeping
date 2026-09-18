import { type DomainError, type Result, type UserId } from '@repo/contracts';
import { type Entry } from '../domain/entry';

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
   * Every entry `userId` owns, the latest day first, and entries on the same
   * day most recently created first.
   */
  readonly list: (userId: UserId) => Promise<Result<readonly Entry[], DomainError>>;
};
