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
