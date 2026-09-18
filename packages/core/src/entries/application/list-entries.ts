import { type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry } from '../domain/entry';
import { type EntryRepository } from '../ports/entry-repository';

export type ListEntriesDependencies = {
  readonly entries: EntryRepository;
};

export type ListEntries = (auth: AuthContext) => Promise<Result<readonly Entry[], DomainError>>;

/**
 * Every entry the signed-in User owns, in the order the repository states:
 * latest day first. Phase 1 lists them all; paging arrives with the criterion
 * that needs it. Nobody signed in is `UNAUTHENTICATED`. ADR-0021.
 */
export function createListEntries({ entries }: ListEntriesDependencies): ListEntries {
  return async (auth) => {
    const userId = requireUser(auth);
    return userId.ok ? entries.list(userId.value) : userId;
  };
}
