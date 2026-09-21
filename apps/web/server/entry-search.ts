import {
  parseSearchQuery,
  type PostedEntry,
  type SearchCriteriaInput,
  type SearchQuery,
} from '@repo/contracts';
import { NO_CRITERIA } from '@repo/core';
import { fromTrpcError } from './domain-error';

/** An Entry search, as the page can ask for one: the procedure, already bound. */
export type SearchForEntries = (
  criteria: SearchCriteriaInput,
) => Promise<readonly PostedEntry[]>;

/**
 * What the Entry search page renders: the criteria to fill back into the form,
 * and either what matched or nothing at all.
 *
 * A refused search carries no entries rather than an empty list, because the
 * two are different answers: an empty list is "nothing matched", and a refusal
 * is "that was not a question I could answer". The page renders no results
 * region for the second, since results would answer a question other than the
 * one the URL states.
 */
export type EntrySearchAnswer =
  | {
      readonly outcome: 'answered';
      readonly criteria: SearchCriteriaInput;
      readonly entries: readonly PostedEntry[];
    }
  | { readonly outcome: 'refused'; readonly criteria: SearchCriteriaInput };

/**
 * Runs the Entry search a URL's query asks for, and turns a refusal of the
 * criteria into an answer the page renders rather than an error it fails on --
 * the reasoning the entry form's Server Action gives.
 *
 * Criteria can be refused in two places and come back as one code. A day that
 * is not a calendar day is refused by the contract, before anything is asked;
 * a range that ends before it starts, an Account the chart of accounts does not
 * hold, and a memo term longer than a memo can be are refused by the domain and
 * raised by the procedure. Every one of them is `INVALID_INPUT`, and every one
 * lands here as `refused`.
 *
 * The search is run whatever the query held, and its answer is discarded when
 * the criteria were refused. It is run for the Session: `/entries/search` is a
 * User's books, so a visitor with no Session has to be sent to sign in rather
 * than told about their typo (ADR-0021), and the procedure is what refuses
 * them. The cost is one read on a malformed URL, which buys the page a single
 * way of asking who is signed in instead of a second one beside `orSignIn`.
 *
 * The search is passed in rather than imported, so that what this decides can
 * be tested without a composition root: the page supplies the procedure wrapped
 * in the redirect that a missing Session turns into.
 */
export async function answerEntrySearch(
  search: SearchForEntries,
  query: SearchQuery,
): Promise<EntrySearchAnswer> {
  const parsed = parseSearchQuery(query);
  // Nothing the URL held was a criterion this search could keep, so the form is
  // filled back in with none. A malformed day could not be shown in a day field
  // anyway.
  const criteria = parsed.ok ? parsed.value : NO_CRITERIA;

  let entries: readonly PostedEntry[];
  try {
    entries = await search(criteria);
  } catch (thrown) {
    if (fromTrpcError(thrown).code === 'INVALID_INPUT') {
      return { outcome: 'refused', criteria };
    }
    throw thrown;
  }

  return parsed.ok ? { outcome: 'answered', criteria, entries } : { outcome: 'refused', criteria };
}
