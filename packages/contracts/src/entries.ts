import { z } from 'zod';
import { type Brand } from './brand';
import { domainError, type DomainError } from './errors';
import { uuidV7Schema } from './id';
import { moneySchema, type Money } from './money';
import { err, ok, type Result } from './result';

export type EntryId = Brand<string, 'EntryId'>;
export const entryIdSchema = uuidV7Schema.transform((id): EntryId => id as EntryId);

export const sideSchema = z.enum(['debit', 'credit']);
export type Side = z.infer<typeof sideSchema>;

export const entryDateSchema = z.iso.date();

export const entryLineSchema = z.object({
  account: z.string(),
  side: sideSchema,
  amount: moneySchema,
});

export type EntryLineInput = z.infer<typeof entryLineSchema>;

export const postEntryInputSchema = z.object({
  entryDate: entryDateSchema,
  memo: z.string(),
  lines: z.array(entryLineSchema),
});

export type PostEntryInput = z.infer<typeof postEntryInputSchema>;

export const postedEntrySchema = z.object({
  id: entryIdSchema,
  entryDate: entryDateSchema,
  memo: z.string(),
  lines: z.array(entryLineSchema),
  total: moneySchema,
  createdAt: z.iso.datetime(),
});

export type PostedEntry = z.infer<typeof postedEntrySchema>;

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

export const SEARCH_CRITERIA_FIELDS = {
  from: 'from',
  to: 'to',
  account: 'account',
  memo: 'memo',
} as const;

export const searchCriteriaSchema = z.object({
  from: entryDateSchema.optional(),
  to: entryDateSchema.optional(),
  account: z.string().optional(),
  memo: z.string().optional(),
});

export type SearchCriteriaInput = z.infer<typeof searchCriteriaSchema>;

export type SearchQuery = {
  readonly [name: string]: string | readonly string[] | undefined;
};

const asked = (value: SearchQuery[string]): SearchQuery[string] =>
  value === '' ? undefined : value;

export function parseSearchQuery(query: SearchQuery): Result<SearchCriteriaInput, DomainError> {
  const parsed = searchCriteriaSchema.safeParse({
    from: asked(query[SEARCH_CRITERIA_FIELDS.from]),
    to: asked(query[SEARCH_CRITERIA_FIELDS.to]),
    account: asked(query[SEARCH_CRITERIA_FIELDS.account]),
    memo: asked(query[SEARCH_CRITERIA_FIELDS.memo]),
  });

  return parsed.success
    ? ok(parsed.data)
    : err(domainError('INVALID_INPUT', 'The search criteria are malformed.'));
}

export const ENTRY_FORM_FIELDS = {
  entryDate: 'entryDate',
  memo: 'memo',
  account: 'account',
  side: 'side',
  amount: 'amount',
} as const;

export type SubmittedFields = {
  readonly get: (name: string) => unknown;
  readonly getAll: (name: string) => readonly unknown[];
};

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
