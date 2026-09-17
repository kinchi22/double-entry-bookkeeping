import { type DomainError, type Result } from '@repo/contracts';
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
 */
export type EntryRepository = {
  /** Stores an entry and its lines, in order, atomically. */
  readonly save: (entry: Entry) => Promise<Result<void, DomainError>>;
  /**
   * Every entry, the latest day first, and entries on the same day most
   * recently created first.
   */
  readonly list: () => Promise<Result<readonly Entry[], DomainError>>;
};
