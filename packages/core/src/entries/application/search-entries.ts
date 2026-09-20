import { type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry } from '../domain/entry';
import { type SearchCriteria } from '../domain/search-criteria';
import { type EntryRepository } from '../ports/entry-repository';

export type SearchEntriesDependencies = {
  readonly entries: EntryRepository;
};

export type SearchEntries = (
  auth: AuthContext,
  criteria: SearchCriteria,
) => Promise<Result<readonly Entry[], DomainError>>;

/**
 * The entries the signed-in User owns that the criteria match, in the order
 * the repository states: latest day first. A search with no criterion is every
 * entry they own, which is what `/entries` asks for. Everything that matches
 * comes back; paging arrives with the criterion that needs it. Nobody signed in
 * is `UNAUTHENTICATED`. ADR-0021.
 */
export function createSearchEntries({ entries }: SearchEntriesDependencies): SearchEntries {
  return async (auth, criteria) => {
    const userId = requireUser(auth);
    return userId.ok ? entries.search(userId.value, criteria) : userId;
  };
}
