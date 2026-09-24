import { type DomainError, type Result, type UserId } from '@repo/contracts';
import { type Entry } from '../domain/entry';
import { type SearchCriteria } from '../domain/search-criteria';

export type EntryRepository = {
  readonly save: (userId: UserId, entry: Entry) => Promise<Result<void, DomainError>>;
  readonly search: (
    userId: UserId,
    criteria: SearchCriteria,
  ) => Promise<Result<readonly Entry[], DomainError>>;
};
