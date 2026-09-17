/**
 * Public surface of the entries feature.
 *
 * Adapters are absent on purpose, as in the health feature: they are reachable
 * only through @repo/core/server, which carries the `server-only` marker.
 */
export {
  CHART_OF_ACCOUNTS,
  MEMO_MAX_LENGTH,
  isAccountCode,
  makeEntry,
} from './domain/entry';
export type { AccountCode, Entry, EntryDraft, EntryLine, EntryStamp } from './domain/entry';

export { createPostEntry } from './application/post-entry';
export type { PostEntry, PostEntryDependencies } from './application/post-entry';

export { createListEntries } from './application/list-entries';
export type { ListEntries, ListEntriesDependencies } from './application/list-entries';

export type { EntryRepository } from './ports/entry-repository';
