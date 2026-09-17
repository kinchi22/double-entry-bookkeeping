import { type DomainError, type Result } from '@repo/contracts';
import { type Entry } from '../domain/entry';
import { type EntryRepository } from '../ports/entry-repository';

export type ListEntriesDependencies = {
  readonly entries: EntryRepository;
};

export type ListEntries = () => Promise<Result<readonly Entry[], DomainError>>;

/**
 * Every entry, in the order the repository states: latest day first. Phase 1
 * lists them all; paging arrives with the criterion that needs it.
 */
export function createListEntries({ entries }: ListEntriesDependencies): ListEntries {
  return (): Promise<Result<readonly Entry[], DomainError>> => entries.list();
}
