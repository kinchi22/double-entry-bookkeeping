import { type DomainError, type EntryId, type Result } from '@repo/contracts';
import { makeEntry, type Entry, type EntryDraft } from '../domain/entry';
import { type EntryRepository } from '../ports/entry-repository';

export type PostEntryDependencies = {
  readonly entries: EntryRepository;
  /** Generating an id is an effect, so it is injected, like the clock. */
  readonly newEntryId: () => EntryId;
  readonly now: () => Date;
};

export type PostEntry = (draft: EntryDraft) => Promise<Result<Entry, DomainError>>;

/**
 * Stamps a draft with an id and an instant, applies the entry's rules, and
 * stores what passes. A refused draft reaches no repository.
 *
 * One aggregate is written, so the atomicity is the repository's (ADR-0011)
 * and this use case opens no boundary of its own.
 */
export function createPostEntry({ entries, newEntryId, now }: PostEntryDependencies): PostEntry {
  return async (draft: EntryDraft): Promise<Result<Entry, DomainError>> => {
    const entry = makeEntry(draft, { id: newEntryId(), createdAt: now() });
    if (!entry.ok) {
      return entry;
    }

    const saved = await entries.save(entry.value);
    return saved.ok ? entry : saved;
  };
}
