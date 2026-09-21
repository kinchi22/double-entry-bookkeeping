import { domainError, err, ok, type DomainError, type Result } from '@repo/contracts';

/**
 * What an Entry search is narrowed by.
 *
 * Each criterion is optional and an absent one matches every entry, so a
 * criterion narrows and never expands, and criteria that are present combine
 * with `and`. Listing every entry is an Entry search with no criterion at all,
 * which is what `NO_CRITERIA` states and what `/entries` asks for.
 *
 * One criterion exists so far: the range of calendar days an entry was posted
 * in, both of whose ends are inclusive. The Account and the memo join it here.
 *
 * The shape of each criterion -- that a day is `YYYY-MM-DD` -- is parsed in
 * `@repo/contracts`, which is why a day is a `string` here. The rule *between*
 * criteria is decided in this file, the way `makeEntry` decides an entry's
 * rules, and the database enforces neither.
 */

/** Criteria as they were asked for, before the rule between them is applied. */
export type SearchCriteriaDraft = {
  /** The first day of the range, `YYYY-MM-DD`, or absent for no first day. */
  readonly from?: string | undefined;
  /** The last day of the range, `YYYY-MM-DD`, or absent for no last day. */
  readonly to?: string | undefined;
};

/** A draft that passed every rule: what a repository is searched with. */
export type SearchCriteria = {
  readonly from?: string;
  readonly to?: string;
};

/** An Entry search narrowed by nothing: every entry the User owns. */
export const NO_CRITERIA: SearchCriteria = {};

/**
 * Applies every rule the criteria have together, and returns them or the first
 * rule they break.
 *
 * There is one such rule: a range must not end before it starts. A range whose
 * ends are the same day is a single day and is allowed. Days are compared as
 * text, which orders `YYYY-MM-DD` exactly as the calendar does, so nothing here
 * parses a date or reaches for a zone.
 *
 * A criterion that was not given is left out rather than carried as an absent
 * value, so what comes back holds the criteria and nothing else.
 *
 * The two `undefined` checks in front of the comparison are there for the
 * compiler rather than for the rule: `>` is not defined over `string |
 * undefined`, and a comparison against an absent end would answer `false`
 * anyway. So the mutation runner reports them as survivors and no test can kill
 * them -- they are equivalent mutants, and removing them is not an option the
 * types leave open.
 */
export function makeSearchCriteria(draft: SearchCriteriaDraft): Result<SearchCriteria, DomainError> {
  const { from, to } = draft;
  if (from !== undefined && to !== undefined && from > to) {
    return err(
      domainError('INVALID_INPUT', `A day range cannot end (${to}) before it starts (${from}).`),
    );
  }

  const criteria: { from?: string; to?: string } = {};
  if (from !== undefined) {
    criteria.from = from;
  }
  if (to !== undefined) {
    criteria.to = to;
  }
  return ok(criteria);
}
