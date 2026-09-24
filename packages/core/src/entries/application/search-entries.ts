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
