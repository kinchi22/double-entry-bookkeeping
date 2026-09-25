import { domainError, type PostedEntry, type SearchCriteriaInput } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { toTrpcError } from './domain-error';
import { answerEntrySearch, type SearchForEntries } from './entry-search';

const ENTRY = {
  id: '01920000-0000-7000-8000-000000000001',
  entryDate: '2026-06-15',
  memo: 'Office supplies',
  lines: [
    { account: 'expense', side: 'debit', amount: 12500 },
    { account: 'cash', side: 'credit', amount: 12500 },
  ],
  total: 12500,
  createdAt: '2026-06-15T00:30:00.000Z',
} as PostedEntry;

const holding = (entries: readonly PostedEntry[]): SearchForEntries => () =>
  Promise.resolve(entries);

const refusing = (code: Parameters<typeof domainError>[0]): SearchForEntries => () =>
  Promise.reject(toTrpcError(domainError(code, 'No.')));

const inRange: SearchForEntries = (criteria: SearchCriteriaInput) =>
  Promise.resolve(
    criteria.from !== undefined && ENTRY.entryDate < criteria.from ? [] : [ENTRY],
  );

describe('answerEntrySearch', () => {
  it('answers with what the search found, under the criteria the query held', async () => {
    const answer = await answerEntrySearch(holding([ENTRY]), {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    expect(answer).toEqual({
      outcome: 'answered',
      criteria: { from: '2026-06-01', to: '2026-06-30' },
      entries: [ENTRY],
    });
  });

  it('reads a query with no parameters as a search for everything', async () => {
    const answer = await answerEntrySearch(inRange, {});

    expect(answer.outcome).toBe('answered');
    expect(answer.criteria.from).toBeUndefined();
  });

  it('searches with the criteria it read, so the range narrows what comes back', async () => {
    const answer = await answerEntrySearch(inRange, { from: '2026-07-01' });

    expect(answer).toEqual({ outcome: 'answered', criteria: { from: '2026-07-01' }, entries: [] });
  });

  it('reads the Account out of the query, and fills it back into the form', async () => {
    const answer = await answerEntrySearch(holding([ENTRY]), { account: 'cash' });

    expect(answer).toEqual({
      outcome: 'answered',
      criteria: { account: 'cash' },
      entries: [ENTRY],
    });
  });

  it('refuses an Account the procedure refuses, and carries the criterion back with it', async () => {
    const answer = await answerEntrySearch(refusing('INVALID_INPUT'), { account: 'petty-cash' });

    expect(answer).toEqual({ outcome: 'refused', criteria: { account: 'petty-cash' } });
  });

  it('reads the memo term out of the query, and fills it back into the form as typed', async () => {
    const answer = await answerEntrySearch(holding([ENTRY]), { memo: '  Supplies  ' });

    expect(answer).toEqual({
      outcome: 'answered',
      criteria: { memo: '  Supplies  ' },
      entries: [ENTRY],
    });
  });

  it('refuses a memo term the procedure refuses, and carries the term back with it', async () => {
    const answer = await answerEntrySearch(refusing('INVALID_INPUT'), { memo: 'supplies' });

    expect(answer).toEqual({ outcome: 'refused', criteria: { memo: 'supplies' } });
  });

  it('refuses a malformed day, and fills no criterion back into the form', async () => {
    const answer = await answerEntrySearch(holding([ENTRY]), { from: 'june' });

    expect(answer.outcome).toBe('refused');
    expect(answer.criteria).toEqual({});
  });

  it('refuses what the procedure refused, and keeps the criteria that produced it', async () => {
    const answer = await answerEntrySearch(refusing('INVALID_INPUT'), {
      from: '2026-06-30',
      to: '2026-06-01',
    });

    expect(answer).toEqual({
      outcome: 'refused',
      criteria: { from: '2026-06-30', to: '2026-06-01' },
    });
  });

  it('asks the procedure even when the query is malformed, so a missing Session still wins', async () => {
    const redirected = new Error('NEXT_REDIRECT');

    await expect(
      answerEntrySearch(() => Promise.reject(redirected), { from: 'june' }),
    ).rejects.toBe(redirected);
  });

  it('passes a failure that is not a refusal of the criteria through', async () => {
    await expect(
      answerEntrySearch(refusing('DEPENDENCY_UNAVAILABLE'), { from: '2026-06-01' }),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('passes anything that is not a refusal at all through', async () => {
    const defect = new Error('DATABASE_URL is not set.');

    await expect(answerEntrySearch(() => Promise.reject(defect), {})).rejects.toBe(defect);
  });
});
