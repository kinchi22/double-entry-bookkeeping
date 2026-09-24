import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { AMOUNT, postEntries, TWELVE_THOUSAND_FIVE_HUNDRED, type Line } from './entries';
import { signIn, signInForSmoke } from './session';

const SEARCH = '/entries/search';
const SEARCH_URL = /\/entries\/search(\?.*)?$/;
const ENTRIES_URL = /\/entries$/;

const lines = (debit: string, credit: string): readonly [Line, Line] => [
  { account: debit, side: 'debit', amount: AMOUNT },
  { account: credit, side: 'credit', amount: AMOUNT },
];

const searchForm = (page: Page): Locator => page.getByRole('form', { name: 'Search entries' });

const results = (page: Page): Locator => page.getByRole('region', { name: 'Results' });

const resultFor = (page: Page, memo: string): Locator =>
  results(page).getByTestId('entry').filter({ hasText: memo });

type Criteria = {
  readonly from?: string;
  readonly to?: string;
  readonly account?: string;
  readonly memo?: string;
};

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

test('reaches the Entry search from the entries page, and returns', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: 'Search' }).click();
  await expect(page).toHaveURL(SEARCH_URL);
  await expect(searchForm(page)).toBeVisible();

  await page.getByRole('link', { name: 'Back to entries' }).click();
  await expect(page).toHaveURL(ENTRIES_URL);
  await expect(page.getByRole('form', { name: 'New entry' })).toBeVisible();
});

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

test('orders the results as `/entries` does: latest day first, and within a day the latest written', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const writtenFirst = `Morning ${run}`;
  const writtenSecond = `Afternoon ${run}`;
  const laterDay = `Next day ${run}`;

  await signIn(page);
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

test('renders the Entry search page and its form', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto(SEARCH);

  await expect(searchForm(page)).toBeVisible();
  await expect(results(page)).toBeVisible();
});
