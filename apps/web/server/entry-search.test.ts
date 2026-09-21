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

/** A search that answers with what it holds, and remembers what it was asked. */
const holding = (entries: readonly PostedEntry[]): SearchForEntries => () =>
  Promise.resolve(entries);

/** A search that refuses, the way the procedure refuses one. */
const refusing = (code: Parameters<typeof domainError>[0]): SearchForEntries => () =>
  Promise.reject(toTrpcError(domainError(code, 'No.')));

/**
 * A search that narrows by the day range it is given, so that what comes back
 * says which criteria reached the procedure. A stub, not a spy: every case
 * below asserts the answer rather than the call.
 */
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

  // The criterion comes back with the refusal, which is what a caller can see
  // here. What the form does with an Account no chart holds is the form's: a
  // select over the chart cannot show one, so it shows "any Account" and the
  // alert says why nothing was searched.
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
    const term = 'a'.repeat(1000);

    const answer = await answerEntrySearch(refusing('INVALID_INPUT'), { memo: term });

    expect(answer).toEqual({ outcome: 'refused', criteria: { memo: term } });
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

  /**
   * The Session is checked by the procedure, so a malformed query must not be
   * answered before the procedure has been asked: a visitor with no Session
   * would be told about their typo instead of being sent to sign in (ADR-0021).
   * What the page passes in turns that refusal into a redirect, which is a
   * throw; here it is a value this test can recognise on the way out.
   */
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
