/**
 * What an Entry search is narrowed by.
 *
 * Each criterion is optional and an absent one matches every entry, so a
 * criterion narrows and never expands, and criteria that are present combine
 * with `and`. Listing every entry is an Entry search with no criterion at all,
 * which is what `NO_CRITERIA` states and what `/entries` asks for.
 *
 * No criterion exists yet: this is the shape the first one is added to, so the
 * task that adds it changes a type rather than every signature that carries it.
 * The rule *between* criteria -- a range whose ends are the right way round --
 * is decided here in `domain/` when there is a range to decide about, the way
 * `makeEntry` decides an entry's rules; the shape of each criterion is parsed
 * in `@repo/contracts`.
 */
export type SearchCriteria = Record<string, never>;

/** An Entry search narrowed by nothing: every entry the User owns. */
export const NO_CRITERIA: SearchCriteria = {};
