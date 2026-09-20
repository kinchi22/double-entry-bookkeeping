import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { AMOUNT, postEntries, TWELVE_THOUSAND_FIVE_HUNDRED, type Line } from './entries';
import { signIn, signInForSmoke } from './session';

/**
 * Entry search: `/entries/search` lists a User's Entries narrowed by Search
 * criteria -- a range of calendar days, an Account, and a substring of the
 * memo. Each criterion is optional, an absent one matches every Entry, and
 * those present combine with `and`.
 *
 * Every name a selector uses here, and in `entries.ts` beside it, is the
 * contract for the page: the form `Search entries`, the fields `From`, `To`,
 * `Account` and `Memo`, the button `Search`, the region `Results`, the `Search`
 * and `Back to entries` links, and the `entry`, `entry-line` and `entry-total`
 * test ids `/entries` already uses -- an Entry looks the same wherever it is
 * rendered. Renaming one is a spec change (ADR-0002).
 *
 * The two terms this page is written in, Entry search and Search criteria, are
 * named in `docs/GLOSSARY.md`. That row does not travel with this pull request:
 * it is not under `e2e/`, and a pull request changes `e2e/` or the rest of the
 * repository, never both (ADR-0002). It lands with the first pull request that
 * builds the page, as #52 says.
 *
 * Every spec but the last writes the Entries it then searches for, so it
 * carries no `@smoke` tag and never runs against Production (ADR-0014). They
 * run in `E2E build`, beside each other and against one database, and a retry
 * writes again -- so each Entry is found by a memo no other run can have
 * written, never by counting or by position. Spec 11 is the exception that
 * proves it: the order *is* what it asserts, so it reads position -- but only
 * within the Entries this run wrote, never as an index into the whole list.
 *
 * Writing an Entry means driving the form on `/entries`, so a spec that needs
 * three or more of them spends most of its budget before it searches at all.
 * Every such spec carries `test.slow()`; four do today. The cost is paid by
 * `Gate liveness`, where every spec fails by timeout against the empty page, so
 * a tripled timeout is a tripled wait there -- which is the reason this is a
 * rule about how much a spec writes, rather than a tag to reach for.
 *
 * Every page here needs a Session (ADR-0021). Each spec signs in as a new User,
 * so it searches books nobody else has written in.
 */

const SEARCH = '/entries/search';
const SEARCH_URL = /\/entries\/search(\?.*)?$/;
const ENTRIES_URL = /\/entries$/;

/** A balanced pair of lines: one debit and one credit, for the same amount. */
const lines = (debit: string, credit: string): readonly [Line, Line] => [
  { account: debit, side: 'debit', amount: AMOUNT },
  { account: credit, side: 'credit', amount: AMOUNT },
];

const searchForm = (page: Page): Locator => page.getByRole('form', { name: 'Search entries' });

/**
 * The region that answers the search. It is named `Results` rather than
 * `Entries` so that a spec can assert the search answered, rather than that
 * some list rendered.
 */
const results = (page: Page): Locator => page.getByRole('region', { name: 'Results' });

/** The result for one memo. Never `nth`, never a count of everything. */
const resultFor = (page: Page, memo: string): Locator =>
  results(page).getByTestId('entry').filter({ hasText: memo });

/** The Search criteria, as the form takes them. An absent one is not typed. */
type Criteria = {
  readonly from?: string;
  readonly to?: string;
  readonly account?: string;
  readonly memo?: string;
};

/**
 * Fills the criteria into the search form and submits it. The labels are
 * matched exactly, because these four names are the contract rather than four
 * substrings of it.
 */
async function search(page: Page, criteria: Criteria): Promise<void> {
  const form = searchForm(page);
  await expect(form).toBeVisible();

  if (criteria.from !== undefined) {
    await form.getByLabel('From', { exact: true }).fill(criteria.from);
  }
  if (criteria.to !== undefined) {
    await form.getByLabel('To', { exact: true }).fill(criteria.to);
  }
  if (criteria.account !== undefined) {
    await form.getByLabel('Account', { exact: true }).selectOption(criteria.account);
  }
  if (criteria.memo !== undefined) {
    await form.getByLabel('Memo', { exact: true }).fill(criteria.memo);
  }

  await form.getByRole('button', { name: 'Search' }).click();
}

/**
 * 1. The page is reachable, and leads back
 *
 * Given a signed-in User on the entries page
 * When they follow the search link, and then the link back
 * Then they are on the Entry search, and then on the entries page again
 *
 * Signing in with nowhere else to go lands on `/entries`, which is where the
 * link out is. Each destination is asserted by what it renders as well as by
 * its URL, so a route that answers with the wrong page does not pass.
 */
test('reaches the Entry search from the entries page, and returns', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: 'Search' }).click();
  await expect(page).toHaveURL(SEARCH_URL);
  await expect(searchForm(page)).toBeVisible();

  await page.getByRole('link', { name: 'Back to entries' }).click();
  await expect(page).toHaveURL(ENTRIES_URL);
  await expect(page.getByRole('form', { name: 'New entry' })).toBeVisible();
});

/**
 * 2. Opened cold
 *
 * Given a User who owns two Entries
 * When they open the Entry search with no criterion
 * Then the form is rendered and both Entries are in the results, whole
 *
 * An Entry search with no criterion is the listing `/entries` already does, so
 * clearing a filter puts the User back where they started. "Whole" is the
 * lines and the total: a result is a posting, not half of one.
 */
test('renders the form and lists every Entry the User owns, opened cold', async ({ page }) => {
  const run = randomUUID();
  const rent = `Rent ${run}`;
  const coffee = `Coffee ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-01', memo: rent, lines: lines('expense', 'cash') },
    { day: '2026-07-01', memo: coffee, lines: lines('expense', 'cash') },
  ]);

  await page.goto(SEARCH);

  await expect(searchForm(page)).toBeVisible();

  const rentResult = resultFor(page, rent);
  await expect(rentResult).toHaveCount(1);
  await expect(rentResult).toContainText('2026-06-01');
  await expect(rentResult.getByTestId('entry-line')).toHaveCount(2);
  await expect(rentResult.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);

  await expect(resultFor(page, coffee)).toHaveCount(1);
});

/**
 * 3. A day range narrows at both of its ends, and includes both of them
 *
 * Given Entries posted the day before the range, on its first day, on its last
 * day, and the day after it
 * When the User searches that range
 * Then the two on the ends are in the results and the two outside it are not
 *
 * The Entries sit exactly on the ends on purpose: an end that is not inclusive
 * makes one of them silently missing, which is the failure this shape catches.
 * There is one Entry outside each end, not just one: with nothing before
 * `from`, a page that ignored `from` altogether and filtered on `to` alone
 * would pass. The absences are asserted after the presences, so a page that
 * rendered nothing at all cannot satisfy them.
 */
test('narrows the results to a day range, both of whose ends are included', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const before = `Last month ${run}`;
  const opening = `Opening day ${run}`;
  const closing = `Closing day ${run}`;
  const after = `Next month ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-05-31', memo: before, lines: lines('expense', 'cash') },
    { day: '2026-06-01', memo: opening, lines: lines('expense', 'cash') },
    { day: '2026-06-30', memo: closing, lines: lines('expense', 'cash') },
    { day: '2026-07-01', memo: after, lines: lines('expense', 'cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30' });

  await expect(resultFor(page, opening)).toHaveCount(1);
  await expect(resultFor(page, closing)).toHaveCount(1);
  await expect(resultFor(page, before)).toHaveCount(0);
  await expect(resultFor(page, after)).toHaveCount(0);
});

/**
 * 4. An Account matches through either side of the posting
 *
 * Given one Entry debiting an Account, one crediting it, and one touching it
 * not at all
 * When the User searches for that Account
 * Then the first two are in the results and the third is not
 *
 * An Entry matches its Account criterion when *any* of its Entry lines names
 * that Account, so the debit and the credit side of the same posting both find
 * it.
 */
test('matches an Entry through either of its Entry lines', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const debited = `Cash in ${run}`;
  const credited = `Cash out ${run}`;
  const untouched = `No cash ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-10', memo: debited, lines: lines('cash', 'sales') },
    { day: '2026-06-11', memo: credited, lines: lines('expense', 'cash') },
    { day: '2026-06-12', memo: untouched, lines: lines('expense', 'payable') },
  ]);

  await page.goto(SEARCH);
  await search(page, { account: 'cash' });

  await expect(resultFor(page, debited)).toHaveCount(1);
  await expect(resultFor(page, credited)).toHaveCount(1);
  await expect(resultFor(page, untouched)).toHaveCount(0);
});

/**
 * 5. A memo substring narrows, whatever its case
 *
 * Given one Entry whose memo contains a word and one whose memo does not
 * When the User searches for part of that word in lower case
 * Then only the first is in the results
 *
 * The memo is typed in lower case and written capitalised, so a search that
 * only matched exactly would find nothing at all.
 */
test('narrows the results to a memo substring, ignoring case', async ({ page }) => {
  const run = randomUUID();
  const beans = `Coffee beans ${run}`;
  const fare = `Rail fare ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-10', memo: beans, lines: lines('expense', 'cash') },
    { day: '2026-06-11', memo: fare, lines: lines('expense', 'cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { memo: 'coffee' });

  await expect(resultFor(page, beans)).toHaveCount(1);
  await expect(resultFor(page, fare)).toHaveCount(0);
});

/**
 * 6. The criteria combine with `and`
 *
 * Given four Entries, of which one meets every criterion and each of the other
 * three fails exactly one of them
 * When the User searches with all three criteria at once
 * Then only the one that meets every criterion is in the results
 *
 * Each near miss is what separates `and` from `or`: under `or` all four would
 * come back, and under a criterion silently dropped, two or three would.
 */
test('narrows with the day range, the Account and the memo together', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const matching = `Rent June ${run}`;
  const wrongDay = `Rent July ${run}`;
  const wrongAccount = `Rent June on account ${run}`;
  const wrongMemo = `Fuel June ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo: matching, lines: lines('expense', 'cash') },
    { day: '2026-07-15', memo: wrongDay, lines: lines('expense', 'cash') },
    { day: '2026-06-15', memo: wrongAccount, lines: lines('expense', 'payable') },
    { day: '2026-06-15', memo: wrongMemo, lines: lines('expense', 'cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30', account: 'cash', memo: 'rent' });

  await expect(resultFor(page, matching)).toHaveCount(1);
  await expect(resultFor(page, wrongDay)).toHaveCount(0);
  await expect(resultFor(page, wrongAccount)).toHaveCount(0);
  await expect(resultFor(page, wrongMemo)).toHaveCount(0);
});

/**
 * 7. The question is still on the page with its answer
 *
 * Given a User who has searched with all three criteria
 * When the results are rendered
 * Then the form still holds the criteria that produced them
 *
 * So that one criterion can be adjusted rather than all of them retyped. The
 * results are asserted first: a form that kept its values while answering some
 * other question would be worse than one that cleared them.
 */
test('keeps the criteria it searched with filled into the form', async ({ page }) => {
  const run = randomUUID();
  const memo = `Stationery ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo, lines: lines('expense', 'cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30', account: 'cash', memo: 'stationery' });

  await expect(resultFor(page, memo)).toHaveCount(1);

  const form = searchForm(page);
  await expect(form.getByLabel('From', { exact: true })).toHaveValue('2026-06-01');
  await expect(form.getByLabel('To', { exact: true })).toHaveValue('2026-06-30');
  await expect(form.getByLabel('Account', { exact: true })).toHaveValue('cash');
  await expect(form.getByLabel('Memo', { exact: true })).toHaveValue('stationery');
});

/**
 * 8. An empty answer says so
 *
 * Given a User who owns an Entry
 * When they search for a memo no Entry of theirs contains
 * Then the results region says nothing matched, and lists nothing
 *
 * An honest empty answer has to be tellable apart from a page that failed, so
 * the message lives in the results region: it *is* the answer. Only what the
 * message is about is pinned here -- that it speaks of matching -- because its
 * wording is copy.
 */
test('says that nothing matched, rather than rendering an empty region', async ({ page }) => {
  const run = randomUUID();
  const memo = `Ferry ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo, lines: lines('expense', 'cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { memo: `absent ${randomUUID()}` });

  await expect(results(page)).toContainText(/match/i);
  await expect(results(page).getByTestId('entry')).toHaveCount(0);
});

/**
 * 9. An impossible range is refused rather than answered
 *
 * Given a User who owns an Entry
 * When they search a range whose `from` is after its `to`
 * Then the page says the range is what is wrong, and shows no results region at
 * all
 *
 * A refused search must not be shown results: they would be the answer to a
 * question other than the one asked. The message only has to mention the range:
 * its wording is copy, and this pins what the refusal is about rather than how
 * it is put, exactly as the imbalance message is pinned on `/entries`. An alert
 * that merely exists would be satisfied by an alert about anything.
 *
 * The alert is looked for inside the page's main content, because Next renders
 * a route announcer with `role="alert"` on every page; `auth.spec.ts` scopes it
 * the same way for the same reason.
 */
test('refuses a reversed day range, explains itself, and shows no list', async ({ page }) => {
  const run = randomUUID();
  const memo = `Ledger ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo, lines: lines('expense', 'cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-30', to: '2026-06-01' });

  await expect(page.getByRole('main').getByRole('alert')).toContainText(/range/i);
  await expect(results(page)).toHaveCount(0);
});

/**
 * 10. The search is not a hole in the wall between books
 *
 * Given one User who has posted an Entry and searched it up
 * When another User searches for that same memo
 * Then their results say nothing matched, and the Entry is not among them
 *
 * The owner's search runs first so that the memo is known to be findable: an
 * absence only means something once the same question has been shown to have
 * an answer. ADR-0021.
 */
test("never shows one User's Entry in another User's results", async ({ browser }) => {
  const memo = `Private ${randomUUID()}`;

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signIn(ownerPage);
  await postEntries(ownerPage, [
    { day: '2026-06-15', memo, lines: lines('expense', 'cash') },
  ]);
  await ownerPage.goto(SEARCH);
  await search(ownerPage, { memo });
  await expect(resultFor(ownerPage, memo)).toHaveCount(1);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage);
  await otherPage.goto(SEARCH);
  await search(otherPage, { memo });

  await expect(results(otherPage)).toContainText(/match/i);
  await expect(resultFor(otherPage, memo)).toHaveCount(0);

  await owner.close();
  await other.close();
});

/**
 * 11. The results are ordered as `/entries` orders them
 *
 * Given two Entries posted on one day, written one after the other, and a third
 * posted on a later day
 * When the User searches for all three
 * Then they come back latest day first, and within the shared day the one
 * written last comes first
 *
 * #52, US-20: the two pages must not disagree about what "latest" means, and
 * the order is the repository's -- `entry_date` descending, then `created_at`.
 * Both keys are asserted, because a page that dropped the tie-break would still
 * look sorted.
 *
 * This is the one spec here where position is the subject rather than the
 * means, which makes it the one most easily written wrongly. It still reads no
 * global index: it writes its own three Entries, searches for the memo only
 * this run can have written, and asserts those three in order relative to one
 * another. Another User's books, or an earlier run's rows, cannot change the
 * answer, and the count is asserted first so a page that rendered one of them
 * cannot pass by accident.
 */
test('orders the results latest day first, and within a day the latest written', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const writtenFirst = `Morning ${run}`;
  const writtenSecond = `Afternoon ${run}`;
  const laterDay = `Next day ${run}`;

  await signIn(page);
  // Posted in this order, so `writtenSecond` is the more recently created of
  // the two sharing a day, and the tie-break has a known right answer.
  await postEntries(page, [
    { day: '2026-06-10', memo: writtenFirst, lines: lines('expense', 'cash') },
    { day: '2026-06-10', memo: writtenSecond, lines: lines('expense', 'cash') },
    { day: '2026-06-11', memo: laterDay, lines: lines('expense', 'cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { memo: run });

  const mine = results(page).getByTestId('entry').filter({ hasText: run });
  await expect(mine).toHaveCount(3);
  await expect(mine.nth(0)).toContainText(laterDay);
  await expect(mine.nth(1)).toContainText(writtenSecond);
  await expect(mine.nth(2)).toContainText(writtenFirst);
});

/**
 * 12. The page answers
 *
 * Given the app is deployed
 * When a visitor opens the Entry search
 * Then the form and the results region are rendered
 *
 * A read, so it is smoke-run against Production, where it is the only thing
 * that shows the route and its query survived the release. It asserts nothing
 * about which Entries come back: the Smoke User's books are not a fixture, and
 * a spec that writes can never carry this tag (ADR-0014).
 *
 * Against Production it reads as the Smoke User; anywhere else, as a new User.
 */
test('renders the Entry search page and its form', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto(SEARCH);

  await expect(searchForm(page)).toBeVisible();
  await expect(results(page)).toBeVisible();
});
