import { type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry } from '../domain/entry';
import { makeSearchCriteria, type SearchCriteriaDraft } from '../domain/search-criteria';
import { type EntryRepository } from '../ports/entry-repository';

export type SearchEntriesDependencies = {
  readonly entries: EntryRepository;
};

export type SearchEntries = (
  auth: AuthContext,
  criteria: SearchCriteriaDraft,
) => Promise<Result<readonly Entry[], DomainError>>;

/**
 * The entries the signed-in User owns that the criteria match, in the order
 * the repository states: latest day first. A search with no criterion is every
 * entry they own, which is what `/entries` asks for. Everything that matches
 * comes back; paging arrives with the criterion that needs it. Nobody signed in
 * is `UNAUTHENTICATED`, before any rule is applied. ADR-0021.
 *
 * The criteria are made before they are searched with, as a draft is made into
 * an entry before it is saved, so criteria that break a rule -- a range that
 * ends before it starts -- reach no repository.
 */
export function createSearchEntries({ entries }: SearchEntriesDependencies): SearchEntries {
  return async (auth, draft) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const criteria = makeSearchCriteria(draft);
    if (!criteria.ok) {
      return criteria;
    }

    return entries.search(userId.value, criteria.value);
  };
}
