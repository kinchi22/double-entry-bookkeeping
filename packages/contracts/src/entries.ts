import { z } from 'zod';
import { type Brand } from './brand';
import { domainError, type DomainError } from './errors';
import { uuidV7Schema } from './id';
import { moneySchema, type Money } from './money';
import { err, ok, type Result } from './result';

/**
 * The entries slice: a posting of two or more lines whose debits balance its
 * credits. ADR-0010.
 *
 * This file states what crosses a wire and nothing more. The rules that make a
 * set of lines an entry -- the chart of accounts, the balance, the memo limit --
 * are decided in `packages/core/src/entries/domain`, so here an account is any
 * string and a memo is any text. Stating a rule in both places would leave two
 * places to keep true, and this package cannot import the one that decides.
 */

export type EntryId = Brand<string, 'EntryId'>;
export const entryIdSchema = uuidV7Schema.transform((id): EntryId => id as EntryId);

/** The direction of a line. The amount never carries it. */
export const sideSchema = z.enum(['debit', 'credit']);
export type Side = z.infer<typeof sideSchema>;

/**
 * A calendar day, `YYYY-MM-DD`. A day rather than an instant, so it has no zone
 * and nothing converts it: it is displayed as it is stored.
 */
export const entryDateSchema = z.iso.date();

export const entryLineSchema = z.object({
  account: z.string(),
  side: sideSchema,
  amount: moneySchema,
});

export type EntryLineInput = z.infer<typeof entryLineSchema>;

/** What posting an entry takes. The id and the instant are the server's. */
export const postEntryInputSchema = z.object({
  entryDate: entryDateSchema,
  memo: z.string(),
  lines: z.array(entryLineSchema),
});

export type PostEntryInput = z.infer<typeof postEntryInputSchema>;

/**
 * An entry as it is listed.
 *
 * `total` is the sum of the debit amounts, which is also the sum of the credit
 * amounts, since a posted entry balances. The domain computes it: a client that
 * summed the lines itself would be doing arithmetic on amounts outside
 * `@repo/core/money`.
 */
export const postedEntrySchema = z.object({
  id: entryIdSchema,
  entryDate: entryDateSchema,
  memo: z.string(),
  lines: z.array(entryLineSchema),
  total: moneySchema,
  /** An instant, as an ISO 8601 string in UTC. See `healthStatusSchema`. */
  createdAt: z.iso.datetime(),
});

export type PostedEntry = z.infer<typeof postedEntrySchema>;

/**
 * An entry as core holds it, in the wire form the contract promises.
 *
 * Structural rather than imported, for the reason `toHealthStatus` gives: this
 * package has no internal dependencies, so it states the shape it serialises
 * and core's `Entry` satisfies it. Each line is rebuilt rather than copied, so
 * only the contract's fields travel.
 */
export function toPostedEntry(entry: {
  readonly id: EntryId;
  readonly entryDate: string;
  readonly memo: string;
  readonly lines: readonly EntryLineInput[];
  readonly total: Money;
  readonly createdAt: Date;
}): PostedEntry {
  return {
    id: entry.id,
    entryDate: entry.entryDate,
    memo: entry.memo,
    lines: entry.lines.map((line) => ({
      account: line.account,
      side: line.side,
      amount: line.amount,
    })),
    total: entry.total,
    createdAt: entry.createdAt.toISOString(),
  };
}

/**
 * The names the Entry search gives its criteria.
 *
 * One set of names, used twice: the search form renders them as its field
 * names, and, because that form is a `GET`, the browser writes those same names
 * into the URL's query, which is where `parseSearchQuery` reads them back.
 */
export const SEARCH_CRITERIA_FIELDS = {
  from: 'from',
  to: 'to',
} as const;

/**
 * Search criteria as they cross a wire: each one optional, and each one already
 * the shape it has to be.
 *
 * The shape of a criterion is decided here; the rule *between* two of them --
 * that a range does not end before it starts -- is decided in
 * `packages/core/src/entries/domain`, for the reason this file's header gives.
 */
export const searchCriteriaSchema = z.object({
  from: entryDateSchema.optional(),
  to: entryDateSchema.optional(),
});

export type SearchCriteriaInput = z.infer<typeof searchCriteriaSchema>;

/** A URL's query, as a server component is handed it. */
export type SearchQuery = {
  readonly [name: string]: string | readonly string[] | undefined;
};

/**
 * A parameter that is not there, and one that is there with nothing in it, are
 * both an absent criterion: a `GET` form submits every field it has, so an
 * empty box arrives as `from=` and means the User asked for no first day.
 * Anything else is a criterion, and a malformed one is refused below rather
 * than dropped.
 */
const asked = (value: SearchQuery[string]): SearchQuery[string] =>
  value === '' ? undefined : value;

/**
 * Reads a URL's query into the criteria an Entry search takes.
 *
 * A criterion that does not parse -- a day that is not a calendar day, or a
 * parameter repeated so that it arrives as a list -- refuses the whole search
 * with `INVALID_INPUT`, so a typo narrows nothing silently.
 */
export function parseSearchQuery(query: SearchQuery): Result<SearchCriteriaInput, DomainError> {
  const parsed = searchCriteriaSchema.safeParse({
    from: asked(query[SEARCH_CRITERIA_FIELDS.from]),
    to: asked(query[SEARCH_CRITERIA_FIELDS.to]),
  });

  return parsed.success
    ? ok(parsed.data)
    : err(domainError('INVALID_INPUT', 'The search criteria are malformed.'));
}

/**
 * The names the entry form gives its fields.
 *
 * The form renders them and `parseEntryForm` reads them, so they are written
 * once. Each line repeats `account`, `side` and `amount`, and a line is the
 * values at one position, in the order the form renders them.
 */
export const ENTRY_FORM_FIELDS = {
  entryDate: 'entryDate',
  memo: 'memo',
  account: 'account',
  side: 'side',
  amount: 'amount',
} as const;

/** Whatever reads submitted fields by name. `FormData` is one. */
export type SubmittedFields = {
  readonly get: (name: string) => unknown;
  readonly getAll: (name: string) => readonly unknown[];
};

/**
 * An amount as the form takes it: plain digits, `12500`. A grouped `12,500` is
 * refused rather than guessed at, because the grouping mark depends on the
 * locale that typed it.
 */
const typedAmountSchema = z
  .string()
  .regex(/^[0-9]+$/)
  .transform(Number)
  .pipe(moneySchema);

const entryFormSchema = z.object({
  entryDate: entryDateSchema,
  memo: z.string(),
  lines: z.array(
    z.object({
      account: z.string(),
      side: sideSchema,
      amount: typedAmountSchema,
    }),
  ),
});

/**
 * Reads a submitted entry form into what posting an entry takes.
 *
 * Lines are zipped by position over the longest of the three lists, so a line
 * missing one of its fields leaves a hole the schema refuses, rather than being
 * dropped or shifting its neighbours.
 */
export function parseEntryForm(form: SubmittedFields): Result<PostEntryInput, DomainError> {
  const accounts = form.getAll(ENTRY_FORM_FIELDS.account);
  const sides = form.getAll(ENTRY_FORM_FIELDS.side);
  const amounts = form.getAll(ENTRY_FORM_FIELDS.amount);
  const lineCount = Math.max(accounts.length, sides.length, amounts.length);

  const parsed = entryFormSchema.safeParse({
    entryDate: form.get(ENTRY_FORM_FIELDS.entryDate),
    memo: form.get(ENTRY_FORM_FIELDS.memo),
    lines: Array.from({ length: lineCount }, (_, index) => ({
      account: accounts[index],
      side: sides[index],
      amount: amounts[index],
    })),
  });

  return parsed.success
    ? ok(parsed.data)
    : err(domainError('INVALID_INPUT', 'The entry form is incomplete or malformed.'));
}
