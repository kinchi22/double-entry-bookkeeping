import { domainError, err, ok, type DomainError, type Result } from '@repo/contracts';
import { isAccountCode, type AccountCode } from './entry';

/**
 * What an Entry search is narrowed by.
 *
 * Each criterion is optional and an absent one matches every entry, so a
 * criterion narrows and never expands, and criteria that are present combine
 * with `and`. Listing every entry is an Entry search with no criterion at all,
 * which is what `NO_CRITERIA` states and what `/entries` asks for.
 *
 * Two criteria exist so far: the range of calendar days an entry was posted in,
 * both of whose ends are inclusive, and the Account one of its lines names. The
 * memo joins them here.
 *
 * What is decided where follows `makeEntry`. A criterion's *shape* -- that a
 * day is `YYYY-MM-DD` -- is parsed in `@repo/contracts`, which is why a day is
 * a `string` here. Everything a criterion has to satisfy that needs to know the
 * model -- which codes the chart of accounts holds, and that a range does not
 * end before it starts -- is decided in this file, the one place the chart is
 * decided. The database enforces none of it.
 */

/** Criteria as they were asked for, before any rule has been applied to them. */
export type SearchCriteriaDraft = {
  /** The first day of the range, `YYYY-MM-DD`, or absent for no first day. */
  readonly from?: string | undefined;
  /** The last day of the range, `YYYY-MM-DD`, or absent for no last day. */
  readonly to?: string | undefined;
  /** The Account an entry has to touch, or absent for any Account. */
  readonly account?: string | undefined;
};

/** A draft that passed every rule: what a repository is searched with. */
export type SearchCriteria = {
  readonly from?: string;
  readonly to?: string;
  readonly account?: AccountCode;
};

/** An Entry search narrowed by nothing: every entry the User owns. */
export const NO_CRITERIA: SearchCriteria = {};

/**
 * Applies every rule the criteria have, and returns them or the first rule they
 * break.
 *
 * There are two. An Account searched for has to be one the chart of accounts
 * holds, so an Account that cannot exist is refused rather than answered with
 * nothing: the two are different answers, and a stale link deserves the first.
 * And a range must not end before it starts. A range whose ends are the same
 * day is a single day and is allowed. Days are compared as text, which orders
 * `YYYY-MM-DD` exactly as the calendar does, so nothing here parses a date or
 * reaches for a zone.
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
  const { from, to, account } = draft;
  if (account !== undefined && !isAccountCode(account)) {
    return err(
      domainError('INVALID_INPUT', `No account named ${account} is in the chart of accounts.`),
    );
  }
  if (from !== undefined && to !== undefined && from > to) {
    return err(
      domainError('INVALID_INPUT', `A day range cannot end (${to}) before it starts (${from}).`),
    );
  }

  const criteria: { from?: string; to?: string; account?: AccountCode } = {};
  if (from !== undefined) {
    criteria.from = from;
  }
  if (to !== undefined) {
    criteria.to = to;
  }
  if (account !== undefined) {
    criteria.account = account;
  }
  return ok(criteria);
}
